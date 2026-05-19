/**
 * Core functionality module
 * This file directly implements or re-exports the core functions
 * to avoid circular dependency issues.
 */

import { Server, Socket } from 'socket.io';
import * as index from './index';
import { log } from './logger';

// Re-exports
export const listMidiInterfaces = index.listMidiInterfaces;
export const simulateMidiInput = index.simulateMidiInput;
export const learnMidiMapping = index.learnMidiMapping;
export const loadConfig = index.loadConfig;
export const saveConfig = index.saveConfig;
export const initOsc = index.initOsc;
export const connectMidiInput = index.connectMidiInput;
export const disconnectMidiInput = index.disconnectMidiInput;
export const addSocketHandlers = index.addSocketHandlers;
export const updateDmxChannel = index.setDmxChannel; // Note the alias
export const setDmxChannels = index.setDmxChannels; // Export bulk channel setting function
export const getDmxChannels = index.getDmxChannels; // Export getter function
export const loadScene = index.loadScene;
export const saveScene = index.saveScene; 
export const loadScenes = index.loadScenes;
export const saveScenes = index.saveScenes;
export const loadActs = index.loadActs;
export const saveActs = index.saveActs;
export const loadFixtures = index.loadFixtures;
export const saveFixtures = index.saveFixtures;
export const loadGroups = index.loadGroups;
export const saveGroups = index.saveGroups;
export const pingArtNetDevice = index.pingArtNetDevice;
export const clearMidiMappings = index.clearMidiMappings;
export const updateArtNetConfig = index.updateArtNetConfig;

// Direct implementation of startLaserTime to avoid circular references
export function startLaserTime(io: Server): void {
  log('Starting laser time sequence from core module', 'SYSTEM');
  return index.startLaserTime(io);
}
