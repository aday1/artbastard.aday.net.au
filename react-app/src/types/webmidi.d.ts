// Type definitions for Web MIDI API
// These types extend the standard interfaces defined in TypeScript DOM libraries

interface Navigator {
  // Returns a Promise that resolves to a MIDIAccess object for communicating with MIDI devices
  // The sysex parameter indicates whether system exclusive access is requested
  requestMIDIAccess(options?: { sysex?: boolean }): Promise<WebMidi.MIDIAccess>;
}

declare namespace WebMidi {
  interface MIDIOptions {
    sysex: boolean;
  }

  interface MIDIAccess extends EventTarget {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    sysexEnabled: boolean;
  }

  interface MIDIInputMap {
    entries(): IterableIterator<[string, MIDIInput]>;
    forEach(callback: (input: MIDIInput, key: string) => void): void;
    get(id: string): MIDIInput | undefined;
    has(id: string): boolean;
    keys(): IterableIterator<string>;
    size: number;
    values(): IterableIterator<MIDIInput>;
    [Symbol.iterator](): IterableIterator<[string, MIDIInput]>;
  }

  interface MIDIOutputMap {
    entries(): IterableIterator<[string, MIDIOutput]>;
    forEach(callback: (output: MIDIOutput, key: string) => void): void;
    get(id: string): MIDIOutput | undefined;
    has(id: string): boolean;
    keys(): IterableIterator<string>;
    size: number;
    values(): IterableIterator<MIDIOutput>;
    [Symbol.iterator](): IterableIterator<[string, MIDIOutput]>;
  }

  interface MIDIPort extends EventTarget {
    connection: MIDIPortConnectionState;
    id: string;
    manufacturer?: string;
    name?: string;
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    state: MIDIPortDeviceState;
    type: MIDIPortType;
    version?: string;
    close(): Promise<void>;
    open(): Promise<void>;
  }

  interface MIDIInput extends MIDIPort {
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }

  interface MIDIOutput extends MIDIPort {
    send(data: Uint8Array | number[], timestamp?: number): void;
    clear(): void;
  }

  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
  }

  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }

  type MIDIPortConnectionState = 'open' | 'closed' | 'pending';
  type MIDIPortDeviceState = 'connected' | 'disconnected';
  type MIDIPortType = 'input' | 'output';
}