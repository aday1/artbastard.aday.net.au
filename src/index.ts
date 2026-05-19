/// <reference path="./types/osc.d.ts" />
import easymidi, { Input } from 'easymidi';
// Import our adapter types to make TypeScript happy
import './types/midi-types';
import { Server, Socket } from 'socket.io';
import os from 'os';
const osc = require('osc');
import fs from 'fs';
import path from 'path';
import EffectsEngine from './effects';
import ping from 'ping';

// Import our separate logger to avoid circular dependencies
import { log } from './logger';

// Import dmxnet using ES6 import syntax
import dmxnet from 'dmxnet';

export interface MidiMessage {
    _type: string;
    channel: number;
    controller?: number;
    value?: number;
    note?: number;
    velocity?: number;
    number?: number;  // For program change messages
    source?: string;
}

// Type definitions
interface Fixture {
    name: string;
    startAddress: number;
    channels: { name: string; type: string }[];
}

interface Group {
    name: string;
    fixtureIndices: number[];
}

interface MidiMapping {
    channel: number;
    note?: number;
    controller?: number;
}

interface Scene {
    name: string;
    channelValues: number[];
    oscAddress: string;
    midiMapping?: MidiMapping;
}

type MidiMappings = { [dmxChannel: number]: MidiMapping };

interface ArtNetConfig {
    ip: string;
    subnet: number;
    universe: number;
    net: number;
    port: number;
    base_refresh_interval: number;
}

interface OscConfig {
    host: string;
    port: number;
    // OSC sending configuration
    sendEnabled: boolean;
    sendHost: string;
    sendPort: number;
}

// Variable declarations
let dmxChannels: number[] = new Array(512).fill(0);
let oscAssignments: string[] = new Array(512).fill('').map((_, i) => `/1/dmx${i + 1}`); // Factory default pattern
let channelNames: string[] = new Array(512).fill('').map((_, i) => `CH ${i + 1}`);
let channelRanges: Array<{ min: number; max: number }> = new Array(512).fill(null).map(() => ({ min: 0, max: 255 }));
let fixtures: Fixture[] = [];
let groups: Group[] = [];
let scenes: Scene[] = [];
let acts: any[] = []; // ACTS data storage
let sender: any = null;
let midiMappings: MidiMappings = {};
let midiInput: Input | null = null;
let currentMidiLearnChannel: number | null = null;
let currentMidiLearnScene: string | null = null;
let midiLearnTimeout: NodeJS.Timeout | null = null;

// OSC variables
let oscReceivePort: any = null;
let oscSendPort: any = null;
// Map to cache custom OSC send ports for different host:port combinations
const customOscSendPorts: Map<string, any> = new Map();

// OSC Configuration
let oscConfig: OscConfig = {
    host: '127.0.0.1',
    port: 8000,
    // OSC sending configuration
    sendEnabled: true,
    sendHost: '127.0.0.1',
    sendPort: 57120
};

// Constants and configurations
const DATA_DIR = path.join(__dirname, '..', 'data');
const SCENES_FILE = path.join(DATA_DIR, 'scenes.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ACTS_FILE = path.join(DATA_DIR, 'acts.json');
const EXPORT_FILE = path.join(DATA_DIR, 'export_config.json');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'app.log');

let isLoggingEnabled = true;
let isConsoleLoggingEnabled = true;

// Default ArtNet configuration
let artNetConfig: ArtNetConfig = {
    ip: "192.168.1.199",
    subnet: 0,
    universe: 0,
    net: 0,
    port: 6454,
    base_refresh_interval: 1000
};

// ArtNet sender
let artnetSender: any;

// Keep track of ArtNet ping status to reduce log noise
let lastArtNetStatus = 'unknown';
let artNetFailureCount = 0;
const MAX_CONSECUTIVE_FAILURES = 3; // Only log every 3rd failure

// Initialize global ArtNet ping status
(global as any).artNetPingStatus = 'unknown';

function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsedConfig = JSON.parse(data);
        artNetConfig = { ...artNetConfig, ...parsedConfig.artNetConfig };
        midiMappings = parsedConfig.midiMappings || {};
        oscAssignments = parsedConfig.oscAssignments || new Array(512).fill('').map((_, i) => `/1/dmx${i + 1}`); // Load OSC assignments or use default
        oscConfig = { ...oscConfig, ...parsedConfig.oscConfig }; // Load OSC config or use default
        // Load channel ranges
        if (parsedConfig.channelRanges && Array.isArray(parsedConfig.channelRanges)) {
            channelRanges = parsedConfig.channelRanges;
            // Ensure array is 512 elements
            while (channelRanges.length < 512) {
                channelRanges.push({ min: 0, max: 255 });
            }
        }
        log('Config loaded', 'INFO', { artNetConfig });
        log('MIDI mappings loaded', 'MIDI', { midiMappings });
        log('OSC assignments loaded', 'OSC', { oscAssignmentsCount: oscAssignments.length });
        log('OSC config loaded', 'OSC', { oscConfig });

        return {
            artNetConfig,
            midiMappings,
            oscAssignments, // Return loaded assignments
            oscConfig // Return loaded OSC config
        };
    } else {
        saveConfig(); // This will save defaults including the new oscAssignments default
        return {
            artNetConfig,
            midiMappings,
            oscAssignments,
            oscConfig
        };
    }
}

function saveConfig() {
    const configToSave = {
        artNetConfig,
        midiMappings,
        oscAssignments, // Save OSC assignments
        oscConfig, // Save OSC config
        channelRanges // Save channel ranges
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2));
    log('Config saved', 'INFO', { config: configToSave });
}

export function getDmxChannels(): number[] {
    return dmxChannels;
}

export function getChannelNames(): string[] {
    return channelNames;
}

export function getChannelRanges(): Array<{ min: number; max: number }> {
    return channelRanges;
}

export function setChannelRange(channel: number, min: number, max: number): boolean {
    if (channel < 0 || channel >= 512) {
        log('Invalid channel index for range', 'ERROR', { channel });
        return false;
    }
    const validMin = Math.max(0, Math.min(255, min));
    const validMax = Math.max(0, Math.min(255, max));
    channelRanges[channel] = { min: validMin, max: Math.max(validMin, validMax) };
    saveConfig();
    return true;
}

// Store active MIDI inputs
let activeMidiInputs: { [name: string]: Input } = {};

// Helper function to check if running in WSL
function isRunningInWsl(): boolean {
    return os.release().toLowerCase().includes('microsoft') ||
        os.release().toLowerCase().includes('wsl');
}

function initializeMidi(io: Server) {
    try {
        // Check if running in WSL environment
        if (isRunningInWsl()) {
            log('WSL environment detected - using browser MIDI API only', 'MIDI');
            io.emit('midiStatus', {
                status: 'wsl',
                message: 'Running in WSL - using browser MIDI API only',
                browserMidiOnly: true
            });
            return;
        }

        // Linux-specific ALSA checks
        if (process.platform === 'linux') {
            const hasSeqDevice = fs.existsSync('/dev/snd/seq');

            if (!hasSeqDevice) {
                log('ALSA sequencer device not available', 'WARN');
                io.emit('midiStatus', {
                    status: 'limited',
                    message: 'ALSA not available - using browser MIDI API',
                    browserMidiOnly: true
                });
                return;
            }
        }

        // Continue with MIDI initialization
        const inputs = easymidi.getInputs();
        log(`Found ${inputs.length} MIDI inputs`, 'MIDI', { inputs });

        io.emit('midiStatus', {
            status: 'ready',
            message: inputs.length > 0 ? 'Hardware MIDI initialized' : 'No hardware MIDI devices found',
            inputs,
            browserMidiOnly: false
        });

    } catch (error) {
        log('MIDI initialization error', 'ERROR', { error });
        io.emit('midiStatus', {
            status: 'error',
            message: 'MIDI hardware initialization failed - using browser MIDI API',
            browserMidiOnly: true
        });
    }
}

function connectMidiInput(io: Server, inputName: string, isBrowserMidi = false) {
    try {
        // Skip hardware MIDI connection if using browser MIDI
        if (isBrowserMidi) {
            log(`Using browser MIDI for input: ${inputName}`, 'MIDI');
            return;
        }

        if (isRunningInWsl()) {
            throw new Error('Hardware MIDI not available in WSL');
        }

        // Check if we're already connected to this input
        if (activeMidiInputs[inputName]) {
            log(`Already connected to MIDI input: ${inputName}`, 'MIDI');
            return;
        }

        // Connect to the selected MIDI input
        const newInput = new easymidi.Input(inputName);
        log(`Successfully created MIDI input for ${inputName}`, 'MIDI');

        // Set up event listeners for this input with improved error handling
        newInput.on('noteon', (msg: MidiMessage) => {
            try {
                // Add source information to the message
                const msgWithSource = { ...msg, source: inputName };
                log('MIDI', 'MIDI', { channel: msg.channel, note: msg.note, velocity: msg.velocity });
                handleMidiMessage(io, 'noteon', msgWithSource as MidiMessage);
            } catch (error) {
                log('Error handling noteon message', 'ERROR', { error, inputName });
            }
        });

        newInput.on('noteoff', (msg: MidiMessage) => {
            try {
                // Also forward noteoff events with source information
                const msgWithSource = { ...msg, source: inputName };
                log('Received noteoff', 'MIDI', { message: msgWithSource });
                io.emit('midiMessage', msgWithSource);
            } catch (error) {
                log('Error handling noteoff message', 'ERROR', { error, inputName });
            }
        });

        newInput.on('cc', (msg: MidiMessage) => {
            try {
                // Add source information to the message
                const msgWithSource = { ...msg, source: inputName };
                log('Received cc', 'MIDI', { message: msgWithSource });
                handleMidiMessage(io, 'cc', msgWithSource as MidiMessage);
            } catch (error) {
                log('Error handling cc message', 'ERROR', { error, inputName });
            }
        });

        // Store this input in our active inputs
        activeMidiInputs[inputName] = newInput;
        midiInput = newInput; // Keep the last one as default for backward compatibility

        log(`MIDI input connected: ${inputName}`, 'MIDI');
        io.emit('midiInterfaceSelected', inputName);
        io.emit('midiInputsActive', Object.keys(activeMidiInputs));
    } catch (error) {
        log(`Error connecting to MIDI input ${inputName}`, 'ERROR', { error });
        io.emit('midiInterfaceError', `Failed to connect to ${inputName}: ${error}`);
    }
}

function disconnectMidiInput(io: Server, inputName: string) {
    if (activeMidiInputs[inputName]) {
        activeMidiInputs[inputName].close();
        delete activeMidiInputs[inputName];
        log(`MIDI input disconnected: ${inputName}`, 'MIDI');
        io.emit('midiInputsActive', Object.keys(activeMidiInputs));
        io.emit('midiInterfaceDisconnected', inputName);

        // If this was the default input, set a new default if available
        if (midiInput === activeMidiInputs[inputName]) {
            const activeInputNames = Object.keys(activeMidiInputs);
            if (activeInputNames.length > 0) {
                midiInput = activeMidiInputs[activeInputNames[0]];
            } else {
                midiInput = null;
            }
        }
    }
}

function initOsc(io: Server) {
    try {
        log('Initializing OSC...', 'OSC');
        log('OSC Configuration:', 'OSC');
        log('  - Listen Address: 0.0.0.0 (all interfaces)', 'OSC');
        log(`  - Listen Port: ${oscConfig.port} (UDP)`, 'OSC');
        log(`  - Send Enabled: ${oscConfig.sendEnabled}`, 'OSC');
        if (oscConfig.sendEnabled) {
            log(`  - Send Host: ${oscConfig.sendHost}`, 'OSC');
            log(`  - Send Port: ${oscConfig.sendPort}`, 'OSC');
        }

        // Create OSC receive port
        const oscPort = new osc.UDPPort({
            localAddress: "0.0.0.0",
            localPort: oscConfig.port,
            metadata: true
        });

        oscPort.on("ready", () => {
            log("OSC Receive Port is ready", 'OSC');
            log(`OSC: Receiving on port ${oscConfig.port} (UDP)`, 'OSC');
            io.emit('oscStatus', { status: 'connected', receivePort: oscConfig.port });
            oscReceivePort = oscPort;
            sender = oscPort; // Keep backward compatibility
        });

        oscPort.on("error", (error: Error) => {
            log('OSC Receive error', 'ERROR', { message: error.message });
            io.emit('oscStatus', { status: 'error', message: error.message });
        });

        oscPort.on("message", (oscMsg: any, timeTag: any, info: any) => {
            log('Raw OSC message received', 'OSC', { address: oscMsg.address, args: oscMsg.args, info });

            // Emit raw message for general purpose client-side handling if needed
            io.emit('oscMessage', {
                address: oscMsg.address,
                args: oscMsg.args,
                timestamp: Date.now()
            });

            // Process for DMX channel activity
            oscAssignments.forEach((assignedAddress, channelIndex) => {
                if (oscMsg.address === assignedAddress && oscMsg.args.length > 0) {
                    log(`OSC address match found: ${oscMsg.address} -> DMX channel ${channelIndex + 1}`, 'OSC');
                    let value = 0.0;
                    const firstArg = oscMsg.args[0];

                    if (typeof firstArg === 'number') {
                        value = parseFloat(firstArg.toString());
                    } else if (typeof firstArg === 'object' && firstArg !== null && 'value' in firstArg && typeof (firstArg as any).value === 'number') {
                        value = parseFloat((firstArg as any).value.toString());
                    } else {
                        log('OSC argument for matched address is not a recognized number format', 'OSC', { address: oscMsg.address, arg: firstArg });
                        return; // Skip if argument is not a number or expected object
                    }

                    // Normalize value to 0.0 - 1.0 (assuming it might come in various ranges, e.g. 0-127, 0-255)
                    // For now, let's assume if it's > 1, it might be from a 0-127 or 0-255 range.
                    // This normalization logic might need adjustment based on typical OSC sources.
                    if (value > 1.0) { // A simple heuristic, might need refinement
                        if (value <= 127.0) value = value / 127.0; // Common MIDI-like range
                        else if (value <= 255.0) value = value / 255.0; // Common DMX-like range
                        // Add other normalizations if needed
                    }

                    value = Math.max(0.0, Math.min(1.0, value)); // Clamp to 0.0-1.0

                    log(`OSC activity for DMX ${channelIndex + 1} (${assignedAddress}): ${value}`, 'OSC', { args: oscMsg.args });
                    io.emit('oscChannelActivity', { channelIndex, value });
                }
            });

            // --- ADVANCED OSC HANDLERS ---

            // Handle /channel/{id} pattern
            if (oscMsg.address.startsWith('/channel/') && oscMsg.args.length > 0) {
                const parts = oscMsg.address.split('/');
                const channelId = parseInt(parts[2]);
                if (!isNaN(channelId) && channelId >= 1 && channelId <= 512) {
                    let value = 0.0;
                    const firstArg = oscMsg.args[0];
                    if (typeof firstArg === 'number') value = firstArg;
                    else if (typeof firstArg === 'object' && firstArg !== null && 'value' in firstArg) value = (firstArg as any).value;

                    // Normalize and scale
                    if (value > 1.0) {
                        if (value <= 127.0) value = value / 127.0;
                        else if (value <= 255.0) value = value / 255.0;
                    }
                    const dmxValue = Math.floor(Math.max(0, Math.min(1.0, value)) * 255);
                    updateDmxChannel(channelId - 1, dmxValue, io);
                }
            }

            // Handle /scene/load [name] pattern
            if (oscMsg.address === '/scene/load' && oscMsg.args.length > 0) {
                const sceneName = typeof oscMsg.args[0] === 'string' ? oscMsg.args[0] :
                    (typeof oscMsg.args[0] === 'object' && 'value' in (oscMsg.args[0] as any) ? (oscMsg.args[0] as any).value : null);
                if (sceneName) {
                    log(`OSC command: Load scene "${sceneName}"`, 'OSC');
                    loadScene(io, sceneName);
                }
            }

            // Handle /scene/save [name] pattern
            if (oscMsg.address === '/scene/save' && oscMsg.args.length > 0) {
                const sceneName = typeof oscMsg.args[0] === 'string' ? oscMsg.args[0] :
                    (typeof oscMsg.args[0] === 'object' && 'value' in (oscMsg.args[0] as any) ? (oscMsg.args[0] as any).value : null);
                if (sceneName) {
                    log(`OSC command: Save scene "${sceneName}"`, 'OSC');
                    // Find if scene exists to get its current OSC address, otherwise default
                    const existing = scenes.find(s => s.name === sceneName);
                    saveScene(io, sceneName, existing ? existing.oscAddress : `/scene/${scenes.length + 1}`, [...dmxChannels]);
                }
            }

            // Handle /master/{id} pattern
            if (oscMsg.address.startsWith('/master/') && oscMsg.args.length > 0) {
                const parts = oscMsg.address.split('/');
                const masterId = parseInt(parts[2]);
                if (!isNaN(masterId)) {
                    let value = 0.0;
                    const firstArg = oscMsg.args[0];
                    if (typeof firstArg === 'number') value = firstArg;
                    else if (typeof firstArg === 'object' && firstArg !== null && 'value' in firstArg) value = (firstArg as any).value;

                    // Normalize
                    if (value > 1.0) {
                        io.emit('oscMasterActivity', { masterId, value: Math.max(0, Math.min(1, value)) });

                        // --- SYNC: Broadcast back to other OSC clients (TouchOSC) ---
                        if (oscConfig.sendEnabled && oscSendPort) {
                            sendOscMessage(`/master/${masterId}`, [{ type: 'f', value: Math.max(0, Math.min(1, value)) }]);
                        }
                    }
                }
            }

            // --- SUPERCONTROL OSC HANDLERS ---
            
            // Handle SuperControl addresses (e.g., /supercontrol/dimmer, /supercontrol/pan, etc.)
            if (oscMsg.address.startsWith('/supercontrol/') && oscMsg.args.length > 0) {
                let value = 0.0;
                const firstArg = oscMsg.args[0];
                
                if (typeof firstArg === 'number') {
                    value = parseFloat(firstArg.toString());
                } else if (typeof firstArg === 'object' && firstArg !== null && 'value' in firstArg) {
                    value = parseFloat((firstArg as any).value.toString());
                } else {
                    log('OSC argument for SuperControl is not a recognized number format', 'OSC', { address: oscMsg.address, arg: firstArg });
                    return;
                }
                
                // Normalize value to 0.0 - 1.0
                if (value > 1.0) {
                    if (value <= 127.0) value = value / 127.0;
                    else if (value <= 255.0) value = value / 255.0;
                }
                value = Math.max(0.0, Math.min(1.0, value));
                
                // Extract control name from address (e.g., /supercontrol/dimmer -> dimmer, /supercontrol/pan/fine -> pan/fine)
                const controlName = oscMsg.address.replace('/supercontrol/', '');
                
                log(`OSC SuperControl: ${controlName} = ${value} (${oscMsg.address})`, 'OSC', { args: oscMsg.args });
                
                // Emit to frontend for SuperControl handling
                io.emit('superControlOsc', {
                    controlName,
                    value,
                    address: oscMsg.address,
                    timestamp: Date.now()
                });
            }

            // --- TEMPO OSC HANDLER ---
            // Handle tempo-related OSC messages (play/pause, tap, etc.)
            // This will be handled by checking against the stored OSC address in the frontend
            if (oscMsg.address.startsWith('/tempo/') || 
                oscMsg.address === '/tempo/playpause' || 
                oscMsg.address === '/tempo/play' || 
                oscMsg.address === '/tempo/stop' || 
                oscMsg.address === '/tempo/toggle' ||
                oscMsg.address === '/tempo/tap') {
                log(`OSC Tempo: ${oscMsg.address}`, 'OSC', { args: oscMsg.args });
                
                // Emit to frontend for tempo control handling
                io.emit('tempoOsc', {
                    address: oscMsg.address,
                    args: oscMsg.args,
                    timestamp: Date.now()
                });
            }
            // --- END TEMPO OSC HANDLER ---

            // --- END ADVANCED OSC HANDLERS ---

            // Process for scene triggers (original individual mapping logic)
            scenes.forEach(scene => {
                if (scene.oscAddress && oscMsg.address === scene.oscAddress && oscMsg.args.length > 0) {
                    let value = 0.0;
                    const firstArg = oscMsg.args[0];

                    if (typeof firstArg === 'number') {
                        value = parseFloat(firstArg.toString());
                    } else if (typeof firstArg === 'object' && firstArg !== null && 'value' in firstArg && typeof (firstArg as any).value === 'number') {
                        value = parseFloat((firstArg as any).value.toString());
                    } else {
                        log('OSC argument for scene trigger is not a recognized number format', 'OSC', { address: oscMsg.address, arg: firstArg });
                        return; // Skip if argument is not a number or expected object
                    }

                    // For scene triggers, we typically want to trigger on button press (value > 0.5)
                    // This handles both 0/1 (button press/release) and 0.0-1.0 (normalized) values
                    if (value > 0.5) {
                        log(`OSC scene trigger: ${scene.name} (${oscMsg.address})`, 'OSC', { args: oscMsg.args });
                        loadScene(io, scene.name);
                    }
                }
            });

            // Process for ACT triggers
            acts.forEach(act => {
                if (act.triggers && act.triggers.length > 0) {
                    act.triggers.forEach(trigger => {
                        if (trigger.type === 'osc' &&
                            trigger.enabled &&
                            trigger.address &&
                            oscMsg.address === trigger.address &&
                            oscMsg.args.length > 0) {

                            let value = 0.0;
                            const firstArg = oscMsg.args[0];

                            if (typeof firstArg === 'number') {
                                value = parseFloat(firstArg.toString());
                            } else if (typeof firstArg === 'object' && firstArg !== null && 'value' in firstArg && typeof (firstArg as any).value === 'number') {
                                value = parseFloat((firstArg as any).value.toString());
                            } else {
                                log('OSC argument for ACT trigger is not a recognized number format', 'OSC', { address: oscMsg.address, arg: firstArg });
                                return; // Skip if argument is not a number or expected object
                            }

                            // For ACT triggers, we typically want to trigger on button press (value > 0.5)
                            if (value > 0.5) {
                                log(`OSC ACT trigger: ${act.name} - ${trigger.action} (${oscMsg.address})`, 'OSC', { args: oscMsg.args });

                                // Emit ACT trigger event to frontend
                                io.emit('actTrigger', {
                                    actId: act.id,
                                    action: trigger.action,
                                    triggerId: trigger.id
                                });
                            }
                        }
                    });
                }
            });
        });

        oscPort.open();
        log("Opening OSC Receive port...", 'OSC');

        // Create OSC send port if sending is enabled
        if (oscConfig.sendEnabled) {
            const oscSendPortInstance = new osc.UDPPort({
                localAddress: "0.0.0.0",
                localPort: 0, // Use any available port for sending
                remoteAddress: oscConfig.sendHost,
                remotePort: oscConfig.sendPort,
                metadata: false
            });

            oscSendPortInstance.on("ready", () => {
                log("OSC Send Port is ready", 'OSC');
                log(`OSC: Sending to ${oscConfig.sendHost}:${oscConfig.sendPort} (UDP)`, 'OSC');
                oscSendPort = oscSendPortInstance;
                io.emit('oscSendStatus', {
                    status: 'connected',
                    sendHost: oscConfig.sendHost,
                    sendPort: oscConfig.sendPort
                });
            });

            oscSendPortInstance.on("error", (error: Error) => {
                log('OSC Send error', 'ERROR', { message: error.message });
                io.emit('oscSendStatus', { status: 'error', message: error.message });
            });

            oscSendPortInstance.open();
            log("Opening OSC Send port...", 'OSC');
        } else {
            log('OSC sending is disabled', 'OSC');
            oscSendPort = null;
        }

    } catch (error) {
        log('Error initializing OSC', 'ERROR', { error });
        io.emit('oscStatus', {
            status: 'error',
            message: `Failed to initialize OSC: ${error}`
        });
    }
}

function initializeArtNet() {
    try {
        const dmxnetInstance = new dmxnet.dmxnet({
            oem: 0,
            sName: "LaserTime",
            lName: "LaserTime DMX Controller",
            log: { level: 'none' } // Use proper log configuration instead of verbose
        });

        // Clean up existing sender if it exists
        if (artnetSender && typeof artnetSender.close === 'function') {
            artnetSender.close();
        }

        artnetSender = dmxnetInstance.newSender({
            ip: artNetConfig.ip,
            subnet: artNetConfig.subnet,
            universe: artNetConfig.universe,
            net: artNetConfig.net,
            port: artNetConfig.port,
            base_refresh_interval: artNetConfig.base_refresh_interval
        });

        // Setup error handlers for the sender
        if (artnetSender.on) {
            artnetSender.on('error', (err: Error) => {
                log('ArtNet sender error', 'ARTNET', { message: err.message }); (global as any).io?.emit('artnetStatus', {
                    status: 'error',
                    message: err.message
                });
            });

            artnetSender.on('timeout', () => {
                log('ArtNet sender timeout - will retry', 'ARTNET'); (global as any).io?.emit('artnetStatus', {
                    status: 'timeout',
                    message: 'Connection timed out - retrying'
                });
            });
        }

        log('ArtNet sender initialized', 'ARTNET', { config: artNetConfig }); (global as any).artNetPingStatus = 'initialized_pending_ping'; // Set status before first ping

        // Initial ping to check connectivity
        if ((global as any).io) {
            pingArtNetDevice((global as any).io, artNetConfig.ip);
        }

        return true;
    } catch (error) {
        log('Error initializing ArtNet', 'ERROR', { error }); (global as any).artNetPingStatus = 'init_failed'; // Set status on initialization failure
        (global as any).io?.emit('artnetStatus', {
            status: 'error',
            message: `Failed to initialize: ${error}`
        });
        return false;
    }
}

function listMidiInterfaces() {
    try {
        // Check if running in WSL using our helper function
        if (isRunningInWsl()) {
            log('WSL environment detected - MIDI hardware interfaces not accessible', 'MIDI');
            return {
                inputs: [],
                outputs: [],
                isWsl: true
            };
        }

        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        log("Available MIDI Inputs", 'MIDI', { inputs });
        log("Available MIDI Outputs", 'MIDI', { outputs });
        return { inputs, outputs, isWsl: false };
    } catch (error) {
        log('Error listing MIDI interfaces', 'ERROR', { error });
        return {
            inputs: [],
            outputs: [],
            error: String(error)
        };
    }
}

function simulateMidiInput(io: Server, type: 'noteon' | 'cc', channel: number, note: number, velocity: number) {
    let midiMessage: MidiMessage;
    if (type === 'noteon') {
        midiMessage = {
            _type: 'noteon',
            channel: channel,
            note: note,
            velocity: velocity
        };
    } else {
        midiMessage = {
            _type: 'cc',
            channel: channel,
            controller: note,
            value: velocity
        };
    }
    handleMidiMessage(io, type, midiMessage);
}

function learnMidiMapping(io: Server, dmxChannel: number, midiMapping: MidiMapping) {
    midiMappings[dmxChannel] = midiMapping;
    io.emit('midiMappingLearned', { channel: dmxChannel, mapping: midiMapping });
    const mappingType = midiMapping.controller !== undefined ? 'CC' : 'Note';
    const mappingValue = midiMapping.controller !== undefined ? midiMapping.controller : midiMapping.note;
    log('MIDI learned', 'MIDI', { 
      dmxChannel: dmxChannel + 1, 
      type: mappingType, 
      value: mappingValue,
      midiChannel: midiMapping.channel + 1
    });
}

function handleMidiMessage(io: Server, type: 'noteon' | 'cc', msg: MidiMessage) {
    // Send the raw MIDI message to all clients
    io.emit('midiMessage', msg);

    // Debug MIDI message - add extra logging when in learn mode
    if (currentMidiLearnChannel !== null) {
        log('MIDI message received during LEARN MODE', 'MIDI', { type, msg });
    }

    // Handle MIDI learn mode
    if (currentMidiLearnChannel !== null) {
        // For MIDI Learn, we're interested in CC messages or Note On messages
        let midiMapping: MidiMapping;
        log('Processing MIDI for learn mode', 'MIDI', { msg });

        if (type === 'noteon') {
            log(`Creating note mapping for channel ${currentMidiLearnChannel}`, 'MIDI');
            midiMapping = {
                channel: msg.channel,
                note: msg.note !== undefined ? msg.note : 0
            };
        } else if (type === 'cc') { // cc
            log(`Creating CC mapping for channel ${currentMidiLearnChannel}`, 'MIDI');
            midiMapping = {
                channel: msg.channel,
                controller: msg.controller !== undefined ? msg.controller : 0
            };
        } else {
            log(`Ignoring message type ${type} for MIDI learn`, 'MIDI');
            return; // Not a message type we care about for learning
        }

        // Store the current channel before clearing it
        const learnedChannel = currentMidiLearnChannel;

        // Learn the mapping
        learnMidiMapping(io, learnedChannel, midiMapping);
        currentMidiLearnChannel = null;

        // Clear the midi learn timeout if it's active
        if (midiLearnTimeout) {
            clearTimeout(midiLearnTimeout);
            midiLearnTimeout = null;
        }

        // Save the config and update clients
        saveConfig();
        io.emit('midiMappingUpdate', midiMappings);

        // Send a confirmation that MIDI learn completed successfully
        log('MIDI learn complete', 'MIDI', { channel: learnedChannel, mapping: midiMapping });
        io.emit('midiLearnComplete', {
            channel: learnedChannel,
            mapping: midiMapping
        });

        return;
    }

    // Handle MIDI scene learn mode
    if (currentMidiLearnScene !== null) {
        const scene = scenes.find(s => s.name === currentMidiLearnScene);
        if (scene) {
            let midiMapping: MidiMapping;

            if (type === 'noteon') {
                midiMapping = {
                    channel: msg.channel,
                    note: msg.note !== undefined ? msg.note : 0
                };
            } else { // cc
                midiMapping = {
                    channel: msg.channel,
                    controller: msg.controller !== undefined ? msg.controller : 0
                };
            }

            scene.midiMapping = midiMapping;
            io.emit('sceneMidiMappingLearned', { scene: currentMidiLearnScene, mapping: midiMapping });
            currentMidiLearnScene = null;

            // Clear the midi learn timeout if it's active
            if (midiLearnTimeout) {
                clearTimeout(midiLearnTimeout);
                midiLearnTimeout = null;
            }

            saveScenes();
            return;
        }
    }

    // Regular MIDI control handling
    if (type === 'cc') {
        // Ensure controller is defined before using it
        if (msg.controller !== undefined) {
            const controlKey = `${msg.channel}:${msg.controller}`;

            // Create a mapping of dmx channels to their new values in one go
            const channelUpdates: Record<number, number> = {};

            for (const [dmxChannel, mapping] of Object.entries(midiMappings)) {
                // Skip if mapping doesn't have controller property
                if (mapping.controller === undefined) continue;

                const mappingKey = `${mapping.channel}:${mapping.controller}`;
                if (mappingKey === controlKey) {
                    const channelIdx = parseInt(dmxChannel);
                    // Make sure value is defined before using it
                    if (msg.value !== undefined) {
                        // Scale MIDI value (0-127) to DMX value (0-255)
                        const scaledValue = Math.floor((msg.value / 127) * 255);
                        // Store for batch update
                        channelUpdates[channelIdx] = scaledValue;
                    }
                }
            }

            // Batch update all affected channels at once
            if (Object.keys(channelUpdates).length > 0) {
                log('MIDI CC', 'MIDI', { channel: msg.channel, controller: msg.controller, value: msg.value, dmxChannels: Object.keys(channelUpdates).length, quiet: true });

                // Update each channel and emit a single batch update
                Object.entries(channelUpdates).forEach(([channelIdx, value]) => {
                    updateDmxChannel(parseInt(channelIdx), value, io);
                });

                // Send a single update to clients with all changed channels
                io.emit('dmxBatchUpdate', channelUpdates);
            }
        }
    } else if (type === 'noteon') {
        // Ensure note is defined before using it
        if (msg.note !== undefined) {
            // Check for scene triggers
            scenes.forEach(scene => {
                if (scene.midiMapping &&
                    scene.midiMapping.channel === msg.channel &&
                    scene.midiMapping.note === msg.note) {
                    loadScene(io, scene.name);
                }
            });
        }
    }
}

function saveScene(io: Server, name: string, oscAddress: string, state: number[]) {
    const existingSceneIndex = scenes.findIndex(s => s.name === name);
    const newScene: Scene = {
        name,
        channelValues: Array.isArray(state) ? state : Object.values(state),
        oscAddress
    };
    if (existingSceneIndex !== -1) {
        scenes[existingSceneIndex] = newScene;
    } else {
        scenes.push(newScene);
    }
    saveScenes();
    io.emit('sceneSaved', name);
    io.emit('sceneList', scenes);
    log('Scene saved', 'INFO', { scene: newScene });
}

function loadScene(io: Server, name: string) {
    const scene = scenes.find(s => s.name === name);
    if (scene) {
        let channelValues: number[];
        if (Array.isArray(scene.channelValues)) {
            channelValues = scene.channelValues;
        } else if (typeof scene.channelValues === 'object') {
            channelValues = Object.values(scene.channelValues);
        } else {
            log('Error loading scene: Invalid channelValues format', 'ERROR', { name });
            io.emit('sceneLoadError', { name, error: 'Invalid channelValues format' });
            return;
        }

        channelValues.forEach((value, index) => {
            if (index < dmxChannels.length) {
                updateDmxChannel(index, value, io);
            }
        });
        io.emit('sceneLoaded', { name, channelValues });
        log('Scene loaded', 'INFO', { name });
    } else {
        log('Error loading scene: Scene not found', 'WARN', { name });
        io.emit('sceneLoadError', { name, error: 'Scene not found' });
    }
}

function updateScene(io: Server, originalName: string, updates: Partial<Scene>) {
    const sceneIndex = scenes.findIndex(s => s.name === originalName);
    if (sceneIndex !== -1) {
        scenes[sceneIndex] = { ...scenes[sceneIndex], ...updates };
        saveScenes();
        io.emit('sceneUpdated', { originalName, updatedScene: scenes[sceneIndex] });
        io.emit('sceneList', scenes);
        log('Scene updated', 'INFO', { originalName, updates });
    } else {
        log('Error updating scene: Scene not found', 'WARN', { originalName });
        io.emit('sceneUpdateError', { originalName, error: 'Scene not found' });
    }
}

function updateDmxChannel(channel: number, value: number, io?: Server) {
    // Clamp value to channel range if set
    const range = channelRanges[channel] || { min: 0, max: 255 };
    const clampedValue = Math.max(range.min, Math.min(range.max, value));

    const previousValue = dmxChannels[channel];
    dmxChannels[channel] = clampedValue;

    // Send to ArtNet
    if (artnetSender) {
        try {
            artnetSender.setChannel(channel, clampedValue);
            artnetSender.transmit();
        } catch (error: any) {
            // Suppress network unreachable errors - device is just not on the network
            const errorMsg = error?.message || String(error) || '';
            const errorCode = error?.code || '';
            if (errorCode !== 'ENETUNREACH' && !errorMsg.includes('ENETUNREACH')) {
                log('ArtNet transmit error', 'ARTNET', { error: errorMsg, code: errorCode, channel: channel + 1 });
            }
            // Don't emit status for every failed transmit - too noisy
        }
        // Log DMX updates - show all changes, but use quiet mode for small changes to reduce noise
        const changeAmount = Math.abs(previousValue - clampedValue);
        if (changeAmount > 0) {
            // Log significant changes (>10) normally, smaller changes quietly
            if (changeAmount > 10 || clampedValue === 0 || clampedValue === 255) {
                log('DMX', 'DMX', { channel: channel + 1, from: previousValue, to: clampedValue });
            } else {
                log('DMX', 'DMX', { channel: channel + 1, from: previousValue, to: clampedValue, quiet: true });
            }
        }
    } else {
        log('ArtNet sender not initialized', 'WARN');
    }

    // Send OSC update if sending is enabled
    if (oscConfig.sendEnabled && oscSendPort) {
        const normalizedValue = clampedValue / 255.0; // Convert DMX 0-255 to OSC 0.0-1.0

        // 1. Send to custom mapped address if it exists
        if (oscAssignments[channel]) {
            sendOscMessage(oscAssignments[channel], [{ type: 'f', value: normalizedValue }]);
        }

        // 2. Always send to the standard pattern /channel/{id} for TouchOSC sync
        sendOscMessage(`/channel/${channel + 1}`, [{ type: 'f', value: normalizedValue }]);
    }

    // Emit Socket.IO event to notify frontend clients (if io is available)
    if (io) {
        io.emit('dmxUpdate', { channel, value: clampedValue });
    }
}

// Function to set all DMX channels at once (for state restoration)
function setDmxChannels(channels: number[]) {
    if (!Array.isArray(channels) || channels.length > 512) {
        log('Invalid channels array for setDmxChannels', 'ERROR', { length: channels?.length });
        return;
    }

    // Check if this is a "set all to zero" operation
    const isAllZero = channels.every(v => v === 0);
    const startTime = Date.now();
    const MAX_TIME_MS = 5000; // 5 seconds maximum

    // Collect OSC messages BEFORE updating channels (so we can check previous values)
    const oscMessages: Array<{ address: string; value: number }> = [];
    if (oscConfig.sendEnabled && oscSendPort) {
        for (let i = 0; i < channels.length && i < 512; i++) {
            // Only send OSC if channel value actually changed (skip if already 0 for zero operations)
            if (oscAssignments[i]) {
                const previousValue = dmxChannels[i] || 0; // Get value BEFORE update
                const newValue = Math.max(0, Math.min(255, channels[i] || 0));

                // Skip if value hasn't changed
                if (previousValue === newValue) {
                    continue;
                }

                // For zero operations, skip channels that are already 0
                if (isAllZero && previousValue === 0) {
                    continue;
                }

                // Include messages that need to be sent
                oscMessages.push({
                    address: oscAssignments[i],
                    value: newValue / 255.0
                });
            }
        }
    }

    // Update all channels
    for (let i = 0; i < Math.min(channels.length, 512); i++) {
        const value = Math.max(0, Math.min(255, channels[i] || 0)); // Ensure value is between 0-255
        dmxChannels[i] = value;
    }

    // Send all channels to ArtNet at once
    if (artnetSender) {
        try {
            for (let i = 0; i < channels.length && i < 512; i++) {
                artnetSender.setChannel(i, dmxChannels[i]);
            }
            artnetSender.transmit();
            log(`Set ${channels.length} DMX channels`, 'DMX');
        } catch (error: any) {
            // Suppress network unreachable errors - device is just not on the network
            const errorMsg = error?.message || String(error) || '';
            const errorCode = error?.code || '';
            if (errorCode !== 'ENETUNREACH' && !errorMsg.includes('ENETUNREACH')) {
                log('ArtNet transmit error', 'ARTNET', { error: errorMsg, code: errorCode });
            }
        }
    } else {
        log('ArtNet sender not initialized - channels set in memory only', 'WARN');
    }

    // Send OSC updates for assigned channels with optimized batching for zero operations
    if (oscConfig.sendEnabled && oscSendPort && oscMessages.length > 0) {
        // Send OSC messages with throttling to complete within 5 seconds
        if (isAllZero && oscMessages.length > 50) {
            // For large zero operations, batch with throttling
            const batchSize = Math.max(10, Math.floor(oscMessages.length / 100)); // Adaptive batch size
            const delayPerBatch = Math.max(1, Math.floor(MAX_TIME_MS / (oscMessages.length / batchSize))); // Calculate delay to fit in 5 seconds

            log(`Sending ${oscMessages.length} OSC zero messages in batches of ${batchSize} with ${delayPerBatch}ms delay`, 'OSC');

            let batchIndex = 0;
            const sendBatch = () => {
                const batch = oscMessages.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
                const currentTime = Date.now();

                // Check if we're running out of time
                if (currentTime - startTime >= MAX_TIME_MS - 100) {
                    // Less than 100ms left, send remaining messages immediately
                    for (const msg of oscMessages.slice(batchIndex * batchSize)) {
                        sendOscMessage(msg.address, [{ type: 'f', value: msg.value }]);
                    }
                    log(`OSC zero operation completed (time limit approaching, sent remaining ${oscMessages.length - batchIndex * batchSize} messages immediately)`, 'OSC');
                    return;
                }

                // Send current batch
                for (const msg of batch) {
                    sendOscMessage(msg.address, [{ type: 'f', value: msg.value }]);
                }

                batchIndex++;

                // Schedule next batch if there are more messages
                if (batchIndex * batchSize < oscMessages.length) {
                    setTimeout(sendBatch, delayPerBatch);
                } else {
                    const elapsed = Date.now() - startTime;
                    log(`OSC zero operation completed in ${elapsed}ms`, 'OSC');
                }
            };

            // Start sending batches
            sendBatch();
        } else {
            // For small operations or non-zero operations, send immediately
            for (const msg of oscMessages) {
                sendOscMessage(msg.address, [{ type: 'f', value: msg.value }]);
            }
        }
    }
}

// OSC message sending function
function sendOscMessage(address: string, args: any[], customHost?: string, customPort?: number) {
    let portToUse: any = null;

    // If custom host/port provided, use or create a custom port
    if (customHost && customPort) {
        const portKey = `${customHost}:${customPort}`;

        // Check if we already have a port for this destination
        if (customOscSendPorts.has(portKey)) {
            portToUse = customOscSendPorts.get(portKey);
        } else {
            // Create a new OSC send port for this custom destination
            try {
                const customPortInstance = new osc.UDPPort({
                    localAddress: "0.0.0.0",
                    localPort: 0, // Use any available port for sending
                    remoteAddress: customHost,
                    remotePort: customPort,
                    metadata: false
                });

                customPortInstance.on("ready", () => {
                    log(`OSC Custom Send Port ready for ${portKey}`, 'OSC');
                });

                customPortInstance.on("error", (error: Error) => {
                    log(`OSC Custom Send error for ${portKey}`, 'ERROR', { message: error.message });
                });

                customPortInstance.open();
                customOscSendPorts.set(portKey, customPortInstance);
                portToUse = customPortInstance;
                log(`Created new OSC send port for ${portKey}`, 'OSC');
            } catch (error) {
                log(`Error creating custom OSC send port for ${portKey}`, 'ERROR', { error });
                return;
            }
        }
    } else {
        // Use default OSC send port
        if (!oscConfig.sendEnabled || !oscSendPort) {
            log('OSC sending is disabled or send port not available', 'OSC');
            return;
        }
        portToUse = oscSendPort;
    }

    try {
        const message = {
            address: address,
            args: args
        };

        portToUse.send(message);

        const argSummary = args.length > 0 && typeof args[0] === 'number' ? args[0] : args.length;
        log('OSC sent', 'OSC', { address, value: argSummary });

        // Emit to clients for debugging/monitoring
        if (global.io) {
            global.io.emit('oscOutgoing', {
                address: address,
                args: args,
                timestamp: Date.now(),
                host: customHost || oscConfig.sendHost,
                port: customPort || oscConfig.sendPort
            });
        }
    } catch (error) {
        log('Error sending OSC message', 'ERROR', { error, address, args, host: customHost, port: customPort });
    }
}

function saveScenes(scenesToSave?: Scene[]) {
    if (scenesToSave) {
        scenes = scenesToSave;
    }
    const scenesJson = JSON.stringify(scenes, null, 2);
    fs.writeFileSync(SCENES_FILE, scenesJson);
    log('Scenes saved', 'INFO', { numScenes: scenes.length, quiet: true });
}

function loadScenes() {
    if (fs.existsSync(SCENES_FILE)) {
        const data = fs.readFileSync(SCENES_FILE, 'utf-8');
        log('Raw scenes data from file', 'INFO', { length: data.length });
        scenes = JSON.parse(data);
        log('Scenes loaded', 'INFO', { numScenes: scenes.length });
        return scenes;
    } else {
        scenes = [];
        saveScenes();
        return scenes;
    }
}

function saveActs(actsToSave?: any[]) {
    if (actsToSave) {
        acts = actsToSave;
    }
    const actsJson = JSON.stringify(acts, null, 2);
    fs.writeFileSync(ACTS_FILE, actsJson);
    log('Acts saved', 'INFO', { numActs: acts.length, quiet: true });
}

function loadActs() {
    if (fs.existsSync(ACTS_FILE)) {
        try {
            const data = fs.readFileSync(ACTS_FILE, 'utf-8');
            acts = JSON.parse(data);
            log('Acts loaded from file', 'INFO', { numActs: acts.length });
            return acts;
        } catch (error) {
            log('Error loading acts from file', 'ERROR', { error: error instanceof Error ? error.message : String(error) });
            acts = [];
            return acts;
        }
    } else {
        log('No acts file found, starting with empty acts', 'INFO');
        acts = [];
        return acts;
    }
}
function getFixturesFilePath() {
    return path.join(DATA_DIR, 'fixtures.json');
}

function loadFixturesBundle() {
    const filePath = getFixturesFilePath();
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            const bundle = JSON.parse(data);
            // If it's the old array format, convert it
            if (Array.isArray(bundle)) {
                return {
                    fixtures: bundle,
                    groups: [],
                    fixtureLayout: [],
                    masterSliders: []
                };
            }
            return {
                fixtures: bundle.fixtures || [],
                groups: bundle.groups || [],
                fixtureLayout: bundle.fixtureLayout || [],
                masterSliders: bundle.masterSliders || []
            };
        } catch (error) {
            log('Error loading fixtures bundle', 'ERROR', { error });
        }
    }
    return { fixtures: [], groups: [], fixtureLayout: [], masterSliders: [] };
}

function saveFixturesBundle(bundle: { fixtures: any[], groups: any[], fixtureLayout: any[], masterSliders: any[] }) {
    try {
        const filePath = getFixturesFilePath();
        fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2));
        log('Fixtures saved', 'INFO', {
            fixtures: bundle.fixtures.length,
            groups: bundle.groups.length,
            quiet: true
        });
        return true;
    } catch (error) {
        log('Error saving fixtures bundle', 'ERROR', { error });
        return false;
    }
}

function saveFixtures(fixturesToSave?: Fixture[]) {
    if (fixturesToSave) {
        fixtures = fixturesToSave;
    }
    const bundle = loadFixturesBundle();
    bundle.fixtures = fixtures;
    saveFixturesBundle(bundle);
}

function loadFixtures() {
    const bundle = loadFixturesBundle();
    fixtures = bundle.fixtures;
    log('Fixtures loaded from bundle', 'INFO', { numFixtures: fixtures.length });
    return fixtures;
}

function saveGroups(groupsToSave?: Group[]) {
    if (groupsToSave) {
        groups = groupsToSave;
    }
    const bundle = loadFixturesBundle();
    bundle.groups = groups;
    saveFixturesBundle(bundle);
}

function loadGroups() {
    const bundle = loadFixturesBundle();
    groups = bundle.groups;
    log('Groups loaded from bundle', 'INFO', { numGroups: groups.length });
    return groups;
}

function pingArtNetDevice(io: Server, ip?: string) {
    // If ip is provided, use it instead of the config IP
    const targetIp = ip || artNetConfig.ip;

    // Use ICMP ping instead of TCP connection
    ping.promise.probe(targetIp, {
        timeout: 1, // 1 second timeout
        min_reply: 1
    })
        .then((result: any) => {
            if (result.alive) {
                // Only log status changes from unreachable to alive
                if (lastArtNetStatus !== 'alive') {
                    log(`ArtNet device at ${targetIp} is alive (ICMP ping reply)`, 'ARTNET');
                    lastArtNetStatus = 'alive';
                    artNetFailureCount = 0;
                }
                (global as any).artNetPingStatus = 'alive'; // Update global status
                io.emit('artnetStatus', { ip: targetIp, status: 'alive' });
            } else {
                // Device is unreachable - suppress warnings, only log on status change
                const newStatus = 'unreachable';
                (global as any).artNetPingStatus = newStatus;

                if (lastArtNetStatus !== newStatus) {
                    // Only log when status changes from alive to unreachable
                    log(`ArtNet device at ${targetIp} is unreachable (no ICMP ping reply)`, 'INFO');
                    artNetFailureCount = 0;
                }
                // Suppress repeated warnings - don't log if already unreachable

                lastArtNetStatus = newStatus;
                io.emit('artnetStatus', {
                    ip: targetIp,
                    status: newStatus,
                    message: `ArtNet device at ${targetIp} is not responding to ping`
                });
            }
        })
        .catch((error: Error) => {
            // Suppress error logging - just update status silently
            const newStatus = 'unreachable';
            (global as any).artNetPingStatus = newStatus;

            if (lastArtNetStatus !== newStatus) {
                // Only log when status changes
                log(`ArtNet device at ${targetIp} is unreachable (ICMP ping failed)`, 'INFO');
                artNetFailureCount = 0;
            }
            // Suppress repeated warnings

            lastArtNetStatus = newStatus;
            io.emit('artnetStatus', {
                ip: targetIp,
                status: newStatus,
                message: `ArtNet device at ${targetIp} is not responding to ping`
            });
        });
}

// Function to load DMX state from last-state.json
function loadDmxState() {
    const statePath = path.join(DATA_DIR, 'last-state.json');
    if (fs.existsSync(statePath)) {
        try {
            const stateData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (stateData.dmxChannels && Array.isArray(stateData.dmxChannels) && stateData.dmxChannels.length === 512) {
                dmxChannels = [...stateData.dmxChannels];
                log('DMX state loaded from last session', 'SYSTEM', { 
                    activeChannels: dmxChannels.filter((v: number) => v > 0).length 
                });
                return true;
            }
        } catch (error) {
            log('Error loading DMX state from last session', 'WARN', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    return false;
}

function startLaserTime(io: Server) {
    loadConfig();
    loadScenes();
    
    // Load DMX state from last session BEFORE initializing anything else
    loadDmxState();

    // Check if we're in WSL and log special message about browser MIDI
    if (isRunningInWsl()) {
        log('Starting in WSL environment - hardware MIDI devices unavailable', 'SYSTEM');
        log('Users can still use Web MIDI API from browsers', 'SYSTEM');
    }

    initializeMidi(io);
    initOsc(io);
    initializeArtNet();

    // Start pinging ArtNet device every 5 seconds
    setInterval(() => pingArtNetDevice(io), 5000);

    io.on('connection', (socket: Socket) => {
        log('A user connected', 'SERVER', { socketId: socket.id });

        // Send initial state to the client
        socket.emit('initialState', {
            dmxChannels,
            oscAssignments,
            channelNames,
            fixtures,
            groups,
            midiMappings,
            artNetConfig,
            scenes
        });

        socket.on('setDmxChannel', ({ channel, value }: { channel: number; value: number }) => {
            log('Setting DMX channel via socket', 'DMX', { channel, value, socketId: socket.id });
            updateDmxChannel(channel, value, io);
        });

        // Handle batch DMX updates (for Face Tracker and other bulk operations)
        socket.on('dmx:batch', (updates: Record<number, number>) => {
            if (!updates || typeof updates !== 'object') {
                log('Invalid batch DMX update payload', 'ERROR', { socketId: socket.id, updates });
                return;
            }

            let updateCount = 0;
            const errors: string[] = [];
            const artnetStatus = artnetSender ? 'initialized' : 'not initialized';

            for (const [channelStr, value] of Object.entries(updates)) {
                const channel = parseInt(channelStr, 10);

                if (isNaN(channel) || typeof value !== 'number') {
                    errors.push(`Invalid channel ${channelStr} or value ${value}`);
                    continue;
                }

                if (channel < 0 || channel >= 512) {
                    errors.push(`Channel ${channel} out of range (0-511)`);
                    continue;
                }

                if (value < 0 || value > 255) {
                    errors.push(`Value ${value} for channel ${channel} out of range (0-255)`);
                    continue;
                }

                updateDmxChannel(channel, value, io);
                updateCount++;
            }

            // Final ArtNet transmission after all channel updates
            if (artnetSender && updateCount > 0) {
                try {
                    artnetSender.transmit();
                } catch (error: any) {
                    // Suppress network unreachable errors - device is just not on the network
                    const errorMsg = error?.message || String(error) || '';
                    const errorCode = error?.code || '';
                    if (errorCode !== 'ENETUNREACH' && !errorMsg.includes('ENETUNREACH')) {
                        log('ArtNet batch transmit error', 'ARTNET', { error: errorMsg, code: errorCode });
                    }
                }
            }

            if (errors.length > 0) {
                log('Batch DMX update completed with errors', 'WARN', { updateCount, errors, socketId: socket.id, artnetStatus });
            } else if (updateCount > 0) {
                log('Batch DMX update completed successfully', 'DMX', { 
                    updateCount, 
                    socketId: socket.id, 
                    artnetStatus,
                    artnetTransmitted: artnetSender ? 'yes' : 'no'
                });
            }
        });

        socket.on('saveScene', ({ name, oscAddress, state }: { name: string; oscAddress: string; state: number[] }) => {
            log('Saving scene via socket', 'INFO', { name, socketId: socket.id });
            saveScene(io, name, oscAddress, state);
        });

        socket.on('loadScene', ({ name }: { name: string }) => {
            log('Loading scene via socket', 'INFO', { name, socketId: socket.id });
            loadScene(io, name);
        });

        // MIDI learn mode handler for the startMidiLearn event
        socket.on('startMidiLearn', ({ channel }: { channel: number }) => {
            log('Starting MIDI learn via socket', 'MIDI', { channel, socketId: socket.id });

            // If already in learn mode, cancel it first
            if (currentMidiLearnChannel !== null) {
                log('Cancelling previous MIDI learn', 'MIDI', { channel: currentMidiLearnChannel });
                io.emit('midiLearnCancelled', { channel: currentMidiLearnChannel });
            }

            // Set the new channel for learning
            currentMidiLearnChannel = channel;

            // Auto-cancel MIDI learn after 30 seconds if no MIDI input is received
            if (midiLearnTimeout) {
                clearTimeout(midiLearnTimeout);
            }

            midiLearnTimeout = setTimeout(() => {
                if (currentMidiLearnChannel !== null) {
                    log('MIDI learn timed out', 'MIDI', { channel: currentMidiLearnChannel });
                    currentMidiLearnChannel = null;
                    io.emit('midiLearnTimeout', { channel });
                }
            }, 30000);

            io.emit('midiLearnStarted', { channel });
        });

        socket.on('learnMidiMapping', ({ channel }: { channel: number }) => {
            log('Starting MIDI learn via learnMidiMapping event', 'MIDI', { channel, socketId: socket.id });

            // If already in learn mode, cancel it first
            if (currentMidiLearnChannel !== null) {
                log('Cancelling previous MIDI learn', 'MIDI', { channel: currentMidiLearnChannel });
                io.emit('midiLearnCancelled', { channel: currentMidiLearnChannel });
            }

            // Set the new channel for learning
            currentMidiLearnChannel = channel;

            // Auto-cancel MIDI learn after 30 seconds if no MIDI input is received
            if (midiLearnTimeout) {
                clearTimeout(midiLearnTimeout);
            }

            midiLearnTimeout = setTimeout(() => {
                if (currentMidiLearnChannel !== null) {
                    log('MIDI learn timed out', 'MIDI', { channel: currentMidiLearnChannel });
                    currentMidiLearnChannel = null;
                    io.emit('midiLearnTimeout', { channel });
                }
            }, 30000);

            io.emit('midiLearnStarted', { channel });
            log('MIDI learn mode ACTIVE', 'MIDI', { channel, socketId: socket.id });
        });

        // Handle browser MIDI messages
        socket.on('browserMidiMessage', (msg: MidiMessage) => {
            log('Received browser MIDI message', 'MIDI', { msg, socketId: socket.id });
            // Forward the message to all clients to maintain MIDI visualization
            io.emit('midiMessage', msg);

            // Process the message the same way we would for hardware MIDI
            if (msg._type === 'noteon' || msg._type === 'cc') {
                handleMidiMessage(io, msg._type as 'noteon' | 'cc', msg);
            }
        });

        // Handle network info request
        socket.on('getNetworkInfo', () => {
            try {
                const networkInterfaces = os.networkInterfaces();
                const interfaces: Array<{ name: string; address: string; family: string; internal: boolean }> = [];

                Object.keys(networkInterfaces).forEach(ifaceName => {
                    const iface = networkInterfaces[ifaceName];
                    if (iface) {
                        iface.forEach(details => {
                            const family = details.family as string | number;
                            const isIPv4 = family === 'IPv4' || family === 4;
                            if (isIPv4) {
                                interfaces.push({
                                    name: ifaceName,
                                    address: details.address,
                                    family: 'IPv4',
                                    internal: details.internal || false
                                });
                            }
                        });
                    }
                });

                // Get server port from environment or default
                const serverPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3030;

                // Prioritize finding a non-internal, likely WiFi/Ethernet IP
                let primaryHost = 'localhost';
                const likelyInterface = interfaces.find(i => !i.internal && (i.name.toLowerCase().includes('wi-fi') || i.name.toLowerCase().includes('ethernet') || i.name.toLowerCase().includes('wlan') || i.name.toLowerCase().includes('en0')));
                const anyExternal = interfaces.find(i => !i.internal);

                if (likelyInterface) {
                    primaryHost = likelyInterface.address;
                } else if (anyExternal) {
                    primaryHost = anyExternal.address;
                }

                // Include OSC configuration details
                socket.emit('networkInfo', {
                    interfaces,
                    primaryHost,
                    serverPort,
                    oscConfig: {
                        receivePort: oscConfig.port,
                        receiveHost: '0.0.0.0',
                        sendEnabled: oscConfig.sendEnabled,
                        sendHost: oscConfig.sendHost || oscConfig.host,
                        sendPort: oscConfig.sendPort || oscConfig.port,
                        interfaceAssignment: '0.0.0.0 (all interfaces)'
                    }
                });
            } catch (error) {
                log('Error getting network info', 'ERROR', { error });
                socket.emit('networkInfo', {
                    interfaces: [],
                    serverHost: '0.0.0.0',
                    serverPort: 3030,
                    oscConfig: {
                        receivePort: oscConfig.port,
                        receiveHost: '0.0.0.0',
                        sendEnabled: oscConfig.sendEnabled,
                        sendHost: oscConfig.sendHost || oscConfig.host,
                        sendPort: oscConfig.sendPort || oscConfig.port,
                        interfaceAssignment: '0.0.0.0 (all interfaces)'
                    }
                });
            }
        });

        socket.on('error', (err: Error) => {
            log('Socket error', 'ERROR', { message: err.message, socketId: socket.id });
        });

        // Handle localStorage sync events
        socket.on('localStorageSync', ({ key, value, sourceId }: { key: string; value: any; sourceId: string }) => {
            // Don't echo back to the sender, but broadcast to all other clients
            socket.broadcast.emit('localStorageUpdate', { key, value, sourceId });
            // Reduced logging noise - only log errors or important syncs
            // log('LocalStorage sync received and broadcasted', 'SERVER', { key, sourceId }, { quiet: true });
        });

        // Handle bulk localStorage sync (for initial sync or full restore)
        socket.on('localStorageBulkSync', ({ data, sourceId }: { data: { [key: string]: any }; sourceId: string }) => {
            // Broadcast to all other clients
            socket.broadcast.emit('localStorageBulkUpdate', { data, sourceId });
            // Reduced logging noise - only log important bulk syncs
            // log('LocalStorage bulk sync received and broadcasted', 'SERVER', { keysCount: Object.keys(data).length, sourceId }, { quiet: true });
        });

        socket.on('disconnect', () => {
            log('User disconnected', 'SERVER', { socketId: socket.id });
        });
    });
}

// Add these missing function declarations
function addSocketHandlers(io: Server) {
    log('Socket handlers being initialized (via addSocketHandlers)', 'SERVER');
    // This is just a placeholder - all handlers are set up in startLaserTime
}

// Create a clearMidiMappings function
function clearMidiMappings(channelToRemove?: number) {
    if (channelToRemove !== undefined) {
        // Remove a specific channel mapping
        if (channelToRemove in midiMappings) {
            delete midiMappings[channelToRemove];
        }
    } else {
        // Clear all mappings
        midiMappings = {};
    }
}

// Create an updateArtNetConfig function
function updateArtNetConfig(config: Partial<ArtNetConfig>) {
    artNetConfig = { ...artNetConfig, ...config };
    // Re-initialize ArtNet with new config if needed
    if (artnetSender) {
        try {
            // Close the existing sender if possible
            if (typeof artnetSender.close === 'function') {
                artnetSender.close();
            }
            // Re-initialize with new config
            initializeArtNet();
        } catch (error) {
            log('Error reinitializing ArtNet with new config', 'ERROR', { error });
        }
    }
}

// Create an updateOscConfig function
function updateOscConfig(io: Server, config: Partial<OscConfig>) {
    oscConfig = { ...oscConfig, ...config };
    log('OSC config updated', 'OSC', { oscConfig });

    // Close existing OSC ports if they exist
    if (oscReceivePort && typeof oscReceivePort.close === 'function') {
        oscReceivePort.close();
        log('Closed existing OSC receive port', 'OSC');
    }
    if (oscSendPort && typeof oscSendPort.close === 'function') {
        oscSendPort.close();
        log('Closed existing OSC send port', 'OSC');
    }

    // Clear the references
    oscReceivePort = null;
    oscSendPort = null;
    sender = null; // Clear backward compatibility reference

    // Reinitialize OSC with new config
    initOsc(io);

    saveConfig(); // Persist changes
    return true;
}

// Create an updateOscAssignment function
export function updateOscAssignment(channelIndex: number, address: string): boolean {
    if (channelIndex < 0 || channelIndex >= oscAssignments.length) {
        log('Invalid channel index for OSC assignment', 'ERROR', { channelIndex });
        return false;
    }
    const oldAddress = oscAssignments[channelIndex];
    oscAssignments[channelIndex] = address;
    saveConfig(); // Persist changes
    // Optionally, broadcast this change to connected clients if they need to be aware of it in real-time
    if ((global as any).io) {
        (global as any).io.emit('oscAssignmentsUpdated', { channelIndex, address });
    }
    log('OSC assignment changed', 'OSC', { 
      channel: channelIndex + 1, 
      from: oldAddress || '(none)', 
      to: address 
    });
    return true;
}

// Use proper ES6 named exports
export {
    log,
    listMidiInterfaces,
    simulateMidiInput,
    learnMidiMapping,
    loadConfig,
    saveConfig,
    initOsc,
    startLaserTime,
    connectMidiInput,
    disconnectMidiInput,
    addSocketHandlers,
    updateDmxChannel as setDmxChannel, // Export with alias
    setDmxChannels, // Export new function for bulk channel setting
    loadScene, saveScene,
    updateScene,
    loadScenes,
    saveScenes,
    loadActs,
    saveActs,
    loadFixtures,
    saveFixtures,
    loadGroups,
    saveGroups,
    pingArtNetDevice, clearMidiMappings,
    updateArtNetConfig,
    updateOscConfig,
    sendOscMessage
};
