import { MidiMessage } from '../index';

// This file provides type definitions that allow using our application's
// MidiMessage interface with the easymidi library's event handlers.

// Extension method for Input class
declare module 'easymidi' {
  interface Input {
    on(event: 'noteon', callback: (msg: MidiMessage) => void): void;
    on(event: 'noteoff', callback: (msg: MidiMessage) => void): void;
    on(event: 'cc', callback: (msg: MidiMessage) => void): void;
    on(event: 'program', callback: (msg: MidiMessage) => void): void;
    on(event: 'pitch', callback: (msg: MidiMessage) => void): void;
    on(event: string, callback: (msg: MidiMessage) => void): void;
  }
}