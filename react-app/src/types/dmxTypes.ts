// Placeholder for DMX related type definitions

export interface DMXChannelCapability {
  capability: string;
  offset: number; // Assuming offset is part of channel data
  // Add other channel properties if discoverable
}

export interface Fixture {
  id: string;
  name: string;
  mode: string; // Changed from 'type' to 'mode'
  startChannel: number;
  channelCount: number;
  manufacturer: string; // Made non-optional based on usage
  channels: DMXChannelCapability[]; // Added based on usage like fixture.channels.some
  // Add other common fixture properties as needed
  // e.g., currentValues?: DMXValue[];
}

export interface Scene {
  id: string;
  name: string;
  values: { [fixtureId: string]: DMXValue[] }; // or a more specific type for values
  // Add other scene properties
  // e.g., fadeTime?: number;
  // e.g., isActive?: boolean;
}

export type DMXValue = number; // Typically a value between 0 and 255

// Add other DMX related types or interfaces as they become necessary
// from compiler errors.

export {}; // Ensures this is treated as a module if no other exports are present initially,
           // but can be removed if actual exports like interfaces are added.
