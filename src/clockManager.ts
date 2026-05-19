// src/clockManager.ts

export type MasterClockSourceId = 'internal' | 'midi-input';

export interface ClockState {
  bpm: number;
  isPlaying: boolean;
  source: MasterClockSourceId;
  beat: number; // Current beat in the bar (e.g., 1, 2, 3, 4 for 4/4)
  bar: number;  // Current bar number
}

export class ClockManager {
  private currentSource: MasterClockSourceId = 'internal';
  private internalBPM: number = 120.0;
  private isInternalPlaying: boolean = false;
  private internalIntervalId: ReturnType<typeof setInterval> | null = null;
  private midiClockIntervalId: ReturnType<typeof setInterval> | null = null;
  private beat: number = 1; // Current beat, 1-indexed
  private bar: number = 1;  // Current bar, 1-indexed
  private timeSignatureNominator: number = 4; // e.g., 4 for 4/4 time
  private midiClockTickCount: number = 0; // For 24 ticks per quarter note

  private subscribers: Array<(state: ClockState) => void> = [];
  private midiClockTickSubscribers: Array<() => void> = [];
  
  // MIDI Output
  private midiOutput: any = null; // easymidi.Output instance
  private selectedMidiOutputName: string | null = null; // Currently selected MIDI output
  private availableMidiOutputs: string[] = []; // List of available MIDI output ports
    // MIDI Input
  private midiInput: any = null; // easymidi.Input instance
  private selectedMidiInputName: string | null = null;  private availableMidiInputs: string[] = [];
  private isReceivingMidiClock: boolean = false;
  private lastMidiClockTickTimestamp: number | null = null;
  private midiClockTickIntervals: number[] = []; // For averaging BPM
  private derivedExternalMidiBPM: number = 120.0;
  private externalMidiClockTickCount: number = 0; // Beat tracking for external MIDI

  constructor() {
    // Initialization logic, if any, beyond property defaults
    this.initializeMidiOutput();
    this.initializeMidiInput(); // Added MIDI Input initialization
  }

  private async initializeMidiOutput(): Promise<void> {
    try {
      // Import easymidi dynamically to avoid issues in browser environments
      const easymidi = await import('easymidi');
      
      // Instead of creating a virtual port (which fails on Windows), 
      // we'll initialize with null and later allow selection of a real MIDI output
      this.midiOutput = null;
      console.log('MIDI Clock system initialized. Please select an output device in settings.');
      
      // Get available MIDI outputs for later selection
      this.availableMidiOutputs = easymidi.getOutputs() || [];
      console.log('Available MIDI outputs:', this.availableMidiOutputs);
    } catch (error) {
      console.warn('Failed to initialize MIDI Clock output system:', error);
      this.midiOutput = null;
      this.availableMidiOutputs = [];
    }
  }
  private async initializeMidiInput(): Promise<void> {
    try {
      const easymidi = await import('easymidi');
      this.availableMidiInputs = easymidi.getInputs() || [];
      console.log('Available MIDI inputs:', this.availableMidiInputs);
      // No default input is opened, user must select one.
    } catch (error) {
      console.warn('Failed to initialize MIDI Input system:', error);
      this.availableMidiInputs = [];
    }
  }

  public subscribe(callback: (state: ClockState) => void): () => void {
    this.subscribers.push(callback);
    // Return an unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notifySubscribers(): void {
    const state = this.getCurrentClockState();
    this.subscribers.forEach(callback => callback(state));
  }  private getCurrentClockState(): ClockState {
    if (this.currentSource === 'internal') {
      return {
        bpm: this.internalBPM,
        isPlaying: this.isInternalPlaying,
        source: this.currentSource,
        beat: this.beat,
        bar: this.bar,
      };
    } else if (this.currentSource === 'midi-input') {
      return {
        bpm: this.derivedExternalMidiBPM,
        isPlaying: this.isReceivingMidiClock,
        source: this.currentSource,
        beat: this.beat,
        bar: this.bar,
      };
    } else {
      return {
        bpm: 0,
        isPlaying: false,
        source: this.currentSource,
        beat: this.beat,
        bar: this.bar,
      };
    }
  }
  public setSource(sourceId: MasterClockSourceId): void {
    if (this.currentSource === sourceId) return;

    // Teardown for the current source
    if (this.currentSource === 'internal') {
      this.stopInternalClock();
    } else if (this.currentSource === 'midi-input') {
      this.stopListeningToMidiInput();
    }

    this.currentSource = sourceId;

    // Setup for the new source
    if (sourceId === 'internal') {
      if (this.isInternalPlaying && !this.internalIntervalId) { // Should be !this.isInternalPlaying
        // If was playing, resume. For now, let togglePlayPause handle starting.
      }
    } else if (sourceId === 'midi-input') {
      if (this.selectedMidiInputName) {
        this.startListeningToMidiInput(this.selectedMidiInputName);
      } else {
        console.warn('MIDI Input source selected, but no input device is chosen.');
      }
    }
    this.notifySubscribers();
  }
  public setBPM(newBPM: number): void {
    if (this.currentSource !== 'internal') {
      console.warn(`Cannot set BPM when source is ${this.currentSource}. BPM is controlled externally.`);
      return;
    }
    if (newBPM <= 0) {
      console.warn('BPM must be positive.');
      return;
    }
    this.internalBPM = newBPM;

    if (this.currentSource === 'internal' && this.isInternalPlaying) {
      this.stopInternalClock();
      this.startInternalClock(false); // Restart with new BPM, don't reset beat/bar
    }
    this.notifySubscribers();
  }  public togglePlayPause(): void {
    console.log(`ClockManager: togglePlayPause called - currentSource: ${this.currentSource}, isInternalPlaying: ${this.isInternalPlaying}`);
    
    if (this.currentSource === 'internal') {
      if (this.isInternalPlaying) {
        console.log('ClockManager: Stopping internal clock');
        this.stopInternalClock();
      } else {
        console.log('ClockManager: Starting internal clock');
        this.startInternalClock(true); // Reset beat/bar on play
      }
    } else if (this.currentSource === 'midi-input') {
      console.warn('Play/Pause is controlled by the external MIDI master when source is midi-input.');
      // Play/Pause is driven by MIDI start/stop messages
    }
    // notifySubscribers is called by start/stopInternalClock or MIDI event handlers
  }  public getAvailableSources(): Array<{ id: MasterClockSourceId; name: string }> {
    return [
      { id: 'internal', name: 'Internal Clock' },
      { id: 'midi-input', name: 'External MIDI Clock'}
    ];
  }
  
  public getAvailableMidiOutputs(): string[] {
    return this.availableMidiOutputs;
  }
  
  public getCurrentMidiOutput(): string | null {
    return this.selectedMidiOutputName;
  }
  
  public async setMidiOutput(outputName: string): Promise<boolean> {
    try {
      if (outputName === this.selectedMidiOutputName) return true; // Already selected
      
      // Close current output if any
      if (this.midiOutput) {
        try {
          this.midiOutput.close();
        } catch (err) {
          console.warn('Error closing previous MIDI output:', err);
        }
      }
      
      // Import easymidi dynamically
      const easymidi = await import('easymidi');
      
      // Check if the output name exists in available outputs
      if (!this.availableMidiOutputs.includes(outputName)) {
        // Try to refresh the list first
        this.availableMidiOutputs = easymidi.getOutputs() || [];
        
        // Check again after refreshing
        if (!this.availableMidiOutputs.includes(outputName)) {
          console.warn(`MIDI output "${outputName}" not found`);
          return false;
        }
      }
      
      // Open the specified output
      this.midiOutput = new easymidi.Output(outputName);
      this.selectedMidiOutputName = outputName;
      console.log(`MIDI Clock output set to: ${outputName}`);
      return true;
    } catch (error) {
      console.error('Failed to set MIDI output:', error);
      this.midiOutput = null;
      this.selectedMidiOutputName = null;
      return false;
    }
  }
  
  public async refreshMidiOutputs(): Promise<string[]> {
    try {
      const easymidi = await import('easymidi');
      this.availableMidiOutputs = easymidi.getOutputs() || [];
      return this.availableMidiOutputs;
    } catch (error) {
      console.error('Failed to refresh MIDI outputs:', error);
      return this.availableMidiOutputs;
    }
  }

  // --- MIDI Input Methods ---
  public getAvailableMidiInputs(): string[] {
    return this.availableMidiInputs;
  }

  public getCurrentMidiInput(): string | null {
    return this.selectedMidiInputName;
  }

  public async setMidiInput(inputName: string): Promise<boolean> {
    try {
      if (inputName === this.selectedMidiInputName && this.midiInput) return true;

      this.stopListeningToMidiInput(); // Stop listening to previous input

      const easymidi = await import('easymidi');
      if (!this.availableMidiInputs.includes(inputName)) {
        await this.refreshMidiInputs(); // Try refreshing if not found
        if (!this.availableMidiInputs.includes(inputName)) {
          console.warn(`MIDI input "${inputName}" not found.`);
          this.selectedMidiInputName = null;
          return false;
        }
      }
      
      this.midiInput = new easymidi.Input(inputName);
      this.selectedMidiInputName = inputName;
      console.log(`MIDI input set to: ${inputName}`);

      if (this.currentSource === 'midi-input') {
        this.startListeningToMidiInput(inputName);
      }
      return true;
    } catch (error) {
      console.error('Failed to set MIDI input:', error);
      this.midiInput = null;
      this.selectedMidiInputName = null;
      return false;
    }
  }

  public async refreshMidiInputs(): Promise<string[]> {
    try {
      const easymidi = await import('easymidi');
      this.availableMidiInputs = easymidi.getInputs() || [];
      // If current input is no longer available, clear it
      if (this.selectedMidiInputName && !this.availableMidiInputs.includes(this.selectedMidiInputName)) {
        console.warn(`Selected MIDI input "${this.selectedMidiInputName}" is no longer available.`);
        this.stopListeningToMidiInput();
        this.selectedMidiInputName = null;
      }
      return this.availableMidiInputs;
    } catch (error) {
      console.error('Failed to refresh MIDI inputs:', error);
      return this.availableMidiInputs; // Return cached list on error
    }
  }

  private startListeningToMidiInput(inputName: string): void {
    if (!this.midiInput || this.selectedMidiInputName !== inputName) {
      // Ensure midiInput is correctly initialized for the selected name
      // This might be redundant if setMidiInput was just called, but good for safety
      this.setMidiInput(inputName).then(success => {
        if (success && this.midiInput) {
          this._attachMidiInputListeners();
        }
      });
    } else if (this.midiInput) {
      this._attachMidiInputListeners();
    }
  }
  
  private _attachMidiInputListeners(): void {
    if (!this.midiInput) return;
    console.log(`Attaching MIDI listeners to ${this.selectedMidiInputName}`);
    this.midiInput.on('start', this.handleMidiInputStart);
    this.midiInput.on('stop', this.handleMidiInputStop);
    this.midiInput.on('clock', this.handleMidiInputClockTick);
    // Potentially: 'continue', 'songpos'
  }

  private stopListeningToMidiInput(): void {
    if (this.midiInput) {
      console.log(`Stopping MIDI listeners for ${this.selectedMidiInputName}`);
      this.midiInput.removeListener('start', this.handleMidiInputStart);
      this.midiInput.removeListener('stop', this.handleMidiInputStop);
      this.midiInput.removeListener('clock', this.handleMidiInputClockTick);
      // Close if not needed by other parts, or manage lifecycle carefully
      // For now, we assume closing and reopening on selection is fine.
      try {
        this.midiInput.close();
      } catch (e) { /* ignore close error */ }
      this.midiInput = null;
    }
    this.isReceivingMidiClock = false;
    this.lastMidiClockTickTimestamp = null;
    this.midiClockTickIntervals = [];
  }

  // Bound arrow functions for MIDI event handlers to preserve 'this' context
  private handleMidiInputStart = (): void => {
    if (this.currentSource !== 'midi-input') return;
    console.log('MIDI Start received');
    this.isReceivingMidiClock = true;
    this.beat = 1;
    this.bar = 1;
    this.externalMidiClockTickCount = 0;
    this.lastMidiClockTickTimestamp = performance.now(); // Initialize for BPM calc
    this.midiClockTickIntervals = [];
    this.notifySubscribers();
  };

  private handleMidiInputStop = (): void => {
    if (this.currentSource !== 'midi-input') return;
    console.log('MIDI Stop received');
    this.isReceivingMidiClock = false;
    this.lastMidiClockTickTimestamp = null;
    this.midiClockTickIntervals = [];
    // Beat and bar can retain their last value or be reset, depends on desired behavior
    this.notifySubscribers();
  };

  private handleMidiInputClockTick = (): void => {
    if (this.currentSource !== 'midi-input' || !this.isReceivingMidiClock) return;

    const now = performance.now();
    if (this.lastMidiClockTickTimestamp !== null) {
      const interval = now - this.lastMidiClockTickTimestamp;
      this.midiClockTickIntervals.push(interval);
      if (this.midiClockTickIntervals.length > 24) { // Keep a rolling window of ~1 beat
        this.midiClockTickIntervals.shift();
      }

      if (this.midiClockTickIntervals.length > 0) {
        const avgInterval = this.midiClockTickIntervals.reduce((a, b) => a + b, 0) / this.midiClockTickIntervals.length;
        if (avgInterval > 0) {
          // BPM = 60,000 ms / (ms per quarter note)
          // ms per quarter note = avgInterval_ms_per_tick * 24 ticks_per_quarter_note
          this.derivedExternalMidiBPM = (60 * 1000) / (avgInterval * 24);
        }
      }
    }
    this.lastMidiClockTickTimestamp = now;

    this.externalMidiClockTickCount++;
    if (this.externalMidiClockTickCount >= 24) { // 24 ticks per quarter note
      this.externalMidiClockTickCount = 0;
      this.beat++;
      if (this.beat > this.timeSignatureNominator) {
        this.beat = 1;
        this.bar++;
      }
    }
    // console.log(`MIDI Tick: Bar ${this.bar}, Beat ${this.beat}, BPM: ${this.derivedExternalMidiBPM.toFixed(2)}`);
    this.notifySubscribers(); // Notify on tick for BPM updates, or less frequently if preferred
  };

  public getState(): ClockState {
    return this.getCurrentClockState();
  }

  public subscribeMidiClockTick(callback: () => void): () => void {
    this.midiClockTickSubscribers.push(callback);
    return () => {
      this.midiClockTickSubscribers = this.midiClockTickSubscribers.filter(sub => sub !== callback);
    };
  }
  private sendMidiClockTick(): void {
    // Send MIDI Clock tick message if output is available
    if (this.midiOutput) {
      try {
        this.midiOutput.send('clock');
      } catch (error) {
        console.warn('Failed to send MIDI clock tick:', error);
      }
    }
    
    // Notify all MIDI clock tick subscribers
    this.midiClockTickSubscribers.forEach(callback => callback());
  }

  private sendMidiClockStart(): void {
    // Send MIDI Clock Start message if output is available
    if (this.midiOutput) {
      try {
        this.midiOutput.send('start');
        console.log('MIDI Clock Start sent');
      } catch (error) {
        console.warn('Failed to send MIDI clock start:', error);
      }
    }
  }

  private sendMidiClockStop(): void {
    // Send MIDI Clock Stop message if output is available
    if (this.midiOutput) {
      try {
        this.midiOutput.send('stop');
        console.log('MIDI Clock Stop sent');
      } catch (error) {
        console.warn('Failed to send MIDI clock stop:', error);
      }
    }
  }  private startInternalClock(resetBeatBar: boolean = true): void {
    if (this.internalIntervalId) return; // Already running

    this.isInternalPlaying = true;
    if (resetBeatBar) {
      this.beat = 1;
      this.bar = 1;
      this.midiClockTickCount = 0;
    }

    // Send MIDI Clock Start message
    this.sendMidiClockStart();

    // Start beat interval (quarter notes)
    const beatIntervalMilliseconds = (60000 / this.internalBPM);
    this.internalIntervalId = setInterval(() => this.handleInternalTick(), beatIntervalMilliseconds);

    // Start MIDI clock interval (24 ticks per quarter note)
    const midiClockIntervalMilliseconds = beatIntervalMilliseconds / 24;
    this.midiClockIntervalId = setInterval(() => this.handleMidiClockTick(), midiClockIntervalMilliseconds);

    console.log(`Internal clock started. BPM: ${this.internalBPM}. Beat/Bar reset: ${resetBeatBar}`);
    this.notifySubscribers();
  }
  private stopInternalClock(): void {
    if (this.internalIntervalId) {
      clearInterval(this.internalIntervalId);
      this.internalIntervalId = null;
    }
    if (this.midiClockIntervalId) {
      clearInterval(this.midiClockIntervalId);
      this.midiClockIntervalId = null;
    }
    
    // Send MIDI Clock Stop message
    this.sendMidiClockStop();
    
    this.isInternalPlaying = false;
    console.log('Internal clock stopped.');
    this.notifySubscribers();
  }  private handleInternalTick(): void {
    this.beat++;
    if (this.beat > this.timeSignatureNominator) {
      this.beat = 1;
      this.bar++;
      // Future: Add logic for bar limits or looping if needed
    }
    
    // console.log(`Tick: Bar ${this.bar}, Beat ${this.beat}`); // For debugging
    this.notifySubscribers();
  }

  private handleMidiClockTick(): void {
    this.midiClockTickCount++;
    
    // Reset tick count every quarter note (24 ticks)
    if (this.midiClockTickCount >= 24) {
      this.midiClockTickCount = 0;
    }
    
    // Send MIDI Clock tick
    this.sendMidiClockTick();
  }

  // --- Additional methods for controlling beat/bar might be needed later ---
  public setBeat(beat: number): void {
    if (beat > 0 && beat <= this.timeSignatureNominator) {
        this.beat = beat;
        this.notifySubscribers();
    }
  }

  public setBar(bar: number): void {
    if (bar > 0) {
        this.bar = bar;
        this.notifySubscribers();
    }
  }

  public setTimeSignatureNominator(nominator: number): void {
    if (nominator > 0) {
        this.timeSignatureNominator = nominator;
        // Optionally reset beat/bar or adjust if current beat > new nominator
        if (this.beat > nominator) {
            this.beat = 1;
            this.bar++; // Or handle differently
        }
        this.notifySubscribers();
    }
  }
}

// Export a singleton instance
export const clockManager = new ClockManager();
