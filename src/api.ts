import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from './logger';
import { getArtNetPingHistory, getLastArtNetPing } from './artnetMonitor';
import { connectServerRoli, disconnectServerRoli, getServerRoliStatus, sendServerRoliTestFrame } from './roliServerDriver';
import { getApc40ServerScreensaverStatus } from './apc40ServerScreensaver';

const execAsync = promisify(exec);
import {
  setDmxChannel,
  setDmxChannels,
  blackoutDmxOutput,
  learnMidiMapping,
  loadScene,
  saveScene,
  updateScene,
  loadConfig,
  saveConfig,
  resetConfigState,
  loadScenes,
  saveScenes,
  loadActs,
  saveActs,
  pingArtNetDevice,
  applyMidiControllerTemplate,
  updateArtNetConfig,
  updateOscAssignment,
  updateOscConfig, // Added import
  getDmxChannels, // Added import
  getChannelNames, // Added import
  getChannelRanges, // Added import
  setChannelRange, // Added import
  saveFixtures, // Added import to sync server fixtures
  getActiveMidiInputNames,
  listMidiInterfaces,
  connectMidiInput,
  disconnectMidiInput,
  rememberMidiAutoConnectDevice,
  forgetMidiAutoConnectDevice,
  clearMidiAutoConnectDevices
} from './index';
import {
  loadFixturesData,
  saveFixturesData,
  saveFixtureFile,
  deleteFixtureFile,
  loadFixtureFile
} from './fixturesPersistence';
import { mintBridgeToken, revokeBridgeToken, hashTokenForDisplay } from './bridgeAuth';
import { getBridgeStatusPayload, getSessionsOverview } from './bridgeRegistry';
import { DEFAULT_SESSION_ID, createSession, ensureSession } from './sessionManager';

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXPORT_FILE = path.join(DATA_DIR, 'all_settings.json');
const FACTORY_RESET_MARKER = path.join(DATA_DIR, '.factory-reset-marker.json');

const writeFactoryResetMarker = (source: string) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      FACTORY_RESET_MARKER,
      JSON.stringify(
        {
          timestamp: Math.floor(Date.now() / 1000),
          source
        },
        null,
        2
      )
    );
  } catch (error) {
    log('Failed to write factory reset marker', 'WARN', { error, source });
  }
};

// Add type definitions for global variables
declare global {
  namespace NodeJS {
    interface Global {
      io: Server
      activeMidiInputs: { [key: string]: any }
      artnetSender: any
      artNetPingStatus: string // Added global variable
    }
  }
}

// Create API router
const apiRouter = express.Router();

function resolveSessionIdFromRequest(req: Request): string {
  const q = req.query.sessionId;
  if (typeof q === 'string' && q.trim()) {
    return q.trim().slice(0, 64);
  }
  const body = req.body?.sessionId;
  if (typeof body === 'string' && body.trim()) {
    return body.trim().slice(0, 64);
  }
  return DEFAULT_SESSION_ID;
}

const requireLocalControlRequest: RequestHandler = (req, res, next) => {
  const remoteAddress = req.socket.remoteAddress || req.ip || '';
  const normalizedAddress = remoteAddress.replace(/^::ffff:/, '');
  if (normalizedAddress === '127.0.0.1' || normalizedAddress === '::1' || normalizedAddress === 'localhost') {
    next();
    return;
  }

  res.status(403).json({ success: false, error: 'Local launcher control endpoint only' });
};

// Add error handling middleware to ensure all responses are valid JSON
apiRouter.use((req, res, next) => {
  // Store the original res.json function
  const originalJson = res.json;

  // Override res.json to ensure it always sends valid JSON
  res.json = function (data) {
    // Make sure response has proper content type
    res.contentType('application/json');

    // Ensure data is an object that can be serialized
    if (data === undefined || data === null) {
      data = {};
    }

    // Call original json method with our processed data
    return originalJson.call(this, data);
  };

  // Continue with request chain
  next();
});

// Middleware to parse JSON
apiRouter.use(express.json({ limit: '10mb' }));

// Add global error handler for API routes
apiRouter.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  log('API error', 'ERROR', { message: err.message, path: req.path, method: req.method });
  if (!res.headersSent) {
    res.status(500).json({
      error: `Server error: ${err.message}`,
      success: false
    });
  }
  next(err);
});

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  const io = global.io;

  const stats = {
    serverStatus: 'healthy',
    socketConnections: io?.engine?.clientsCount || 0,
    socketStatus: (io?.sockets?.sockets?.size || 0) > 0 ? 'listening' : 'not listening',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
    midiDevicesConnected: Object.keys(global.activeMidiInputs || {}).length,
    artnetStatus: (global as any).artNetPingStatus || 'unknown',
    artnetLastPing: getLastArtNetPing(),
    artnetPingHistory: getArtNetPingHistory()
  };

  const isHealthy = stats.serverStatus === 'healthy';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    ...stats
  });
});

// Logs endpoints
apiRouter.get('/logs', (req, res) => {
  try {
    const LOGS_DIR = path.join(__dirname, '..', 'logs');
    const LOG_FILE = path.join(LOGS_DIR, 'app.log');

    // Check if log file exists
    if (!fs.existsSync(LOG_FILE)) {
      res.type('text/plain').send('');
      return;
    }

    const typesParam = typeof req.query.types === 'string' ? req.query.types : '';
    const wantedTypes = new Set(
      typesParam
        .split(',')
        .map((type) => type.trim().toUpperCase())
        .filter(Boolean)
    );
    const tail = Math.max(0, Math.min(5000, Number(req.query.tail || 0) || 0));

    let lines = fs.readFileSync(LOG_FILE, 'utf-8').split(/\r?\n/).filter(Boolean);
    if (wantedTypes.size > 0) {
      lines = lines.filter((line) => {
        const match = line.match(/\[(\w+)\]/);
        return Boolean(match && wantedTypes.has(match[1].toUpperCase()));
      });
    }
    if (tail > 0 && lines.length > tail) {
      lines = lines.slice(-tail);
    }

    res.type('text/plain').send(lines.join('\n'));
  } catch (error) {
    log('Error reading log file', 'ERROR', { error });
    res.status(500).type('text/plain').send('Error reading log file');
  }
});

apiRouter.post('/logs/clear', (req, res) => {
  try {
    const LOGS_DIR = path.join(__dirname, '..', 'logs');
    const LOG_FILE = path.join(LOGS_DIR, 'app.log');

    // Clear the log file by writing an empty string
    if (fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '');
    }

    log('Log file cleared via API', 'SYSTEM');
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error) {
    log('Error clearing log file', 'ERROR', { error });
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

apiRouter.get('/roli/server/status', (_req, res) => {
  res.json(getServerRoliStatus());
});

apiRouter.post('/roli/server/connect', async (req, res) => {
  const io = (global as any).io as Server;
  const { inputName, outputName } = req.body || {};
  res.json(await connectServerRoli(io, inputName, outputName));
});

apiRouter.post('/roli/server/disconnect', (_req, res) => {
  disconnectServerRoli();
  res.json(getServerRoliStatus());
});

apiRouter.post('/roli/server/test-frame', (_req, res) => {
  const sent = sendServerRoliTestFrame();
  res.json({ sent, status: getServerRoliStatus() });
});

apiRouter.get('/screensaver/server/status', (_req, res) => {
  res.json({
    roli: getServerRoliStatus(),
    apc40: getApc40ServerScreensaverStatus(),
  });
});

// Helper functions for fixture templates
export const loadFixtureTemplates = () => {
  try {
    const templatesPath = path.join(DATA_DIR, 'fixture-templates.json');
    if (!fs.existsSync(templatesPath)) {
      // Create empty templates file if it doesn't exist
      const emptyTemplates: any[] = [];
      fs.writeFileSync(templatesPath, JSON.stringify(emptyTemplates, null, 2));
      return emptyTemplates;
    }
    const templatesData = fs.readFileSync(templatesPath, 'utf-8');
    const templates = JSON.parse(templatesData);
    // Ensure it's an array
    return Array.isArray(templates) ? templates : [];
  } catch (error) {
    log('Error loading fixture templates', 'ERROR', { error });
    return [];
  }
};

const saveFixtureTemplates = (templates: any[]) => {
  try {
    const templatesPath = path.join(DATA_DIR, 'fixture-templates.json');
    // Only save custom templates (not built-in ones)
    const customTemplates = templates.filter(t => !t.isBuiltIn);
    fs.writeFileSync(templatesPath, JSON.stringify(customTemplates, null, 2));
    log('Fixture templates saved successfully', 'INFO', { count: customTemplates.length });
    return true;
  } catch (error) {
    log('Error saving fixture templates', 'ERROR', { error });
    return false;
  }
};

// Check for factory reset marker. Consume-on-read: delete the marker as soon
// as we report factoryReset:true, otherwise the client's post-reset reload
// sees the marker again and triggers another reload, looping until expiry.
apiRouter.get('/factory-reset-check', (req, res) => {
  try {
    if (!fs.existsSync(FACTORY_RESET_MARKER)) {
      return res.json({ factoryReset: false });
    }

    let markerTimestamp = 0;
    try {
      const markerData = JSON.parse(fs.readFileSync(FACTORY_RESET_MARKER, 'utf-8'));
      markerTimestamp = markerData.timestamp || 0;
    } catch {
      // Corrupt marker — treat as stale and clear it below.
    }

    try { fs.unlinkSync(FACTORY_RESET_MARKER); } catch { /* race ok */ }

    const now = Math.floor(Date.now() / 1000);
    const markerAge = now - markerTimestamp;
    if (markerTimestamp <= 0 || markerAge > 60) {
      return res.json({ factoryReset: false });
    }
    return res.json({ factoryReset: true, timestamp: markerTimestamp });
  } catch (error) {
    log('Error checking factory reset marker', 'ERROR', { error });
    return res.json({ factoryReset: false });
  }
});

// Get initial state
apiRouter.get('/state', (req, res) => {
  try {
    // Load configuration and scenes
    const config = loadConfig(); // loadConfig now also returns oscAssignments

    // Handle missing scenes.json gracefully (e.g., after factory reset)
    let scenes = [];
    try {
      const scenesPath = path.join(DATA_DIR, 'scenes.json');
      if (fs.existsSync(scenesPath)) {
        const scenesData = fs.readFileSync(scenesPath, 'utf-8');
        scenes = JSON.parse(scenesData);
      }
    } catch (error) {
      log('Error loading scenes.json, using empty array', 'WARN', { error });
      scenes = [];
    }

    // Read fixtures data from file (handles missing files gracefully)
    const fixturesData = loadFixturesData();

    // Return all state, using actual values from server where available
    res.json({
      artNetConfig: config.artNetConfig,
      oscConfig: config.oscConfig, // Include OSC configuration
      midiMappings: config.midiMappings || {},
      scenes,
      dmxChannels: getDmxChannels(resolveSessionIdFromRequest(req)),
      sessionId: resolveSessionIdFromRequest(req),
      oscAssignments: config.oscAssignments || [], // Use loaded OSC assignments
      channelNames: getChannelNames(), // Use getter for actual channel names
      channelRanges: getChannelRanges(), // Use getter for channel ranges
      fixtures: fixturesData.fixtures || [],
      groups: fixturesData.groups || [],
      fixtureLayout: fixturesData.fixtureLayout || [],
      masterSliders: fixturesData.masterSliders || [],
      fixtureTemplates: loadFixtureTemplates()
    });
  } catch (error) {
    log('Error getting initial state', 'ERROR', { error });
    res.status(500).json({ error: `Failed to get initial state: ${error}` });
  }
});

// Set DMX channel value
const dmxHandler: RequestHandler = (req: Request, res: Response) => {
  try {
    const { channel, value } = req.body;

    if (typeof channel !== 'number' || typeof value !== 'number') {
      res.status(400).json({ error: 'Invalid channel or value' });
      return;
    }

    const sessionId = resolveSessionIdFromRequest(req);
    setDmxChannel(channel, value, undefined, sessionId);
    res.json({ success: true, sessionId });
  } catch (error) {
    log('Error setting DMX channel', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to set DMX channel: ${error}` });
  }
};

apiRouter.post('/dmx', dmxHandler);

// Batch DMX update endpoint
const batchDmxHandler: RequestHandler = (req: Request, res: Response) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ error: 'Invalid batch update payload' });
      return;
    }

    const sessionId = resolveSessionIdFromRequest(req);
    const updateEntries = Object.entries(updates);
    const updateCount = updateEntries.length;

    // Check if this is a "set all to zero" operation (all values are 0 and many channels)
    const allZero = updateEntries.every(([_, value]) => value === 0);
    const isLargeBatch = updateCount > 50;

    // For large batches or all-zero operations, use optimized setDmxChannels
    if ((allZero && updateCount > 10) || (isLargeBatch && updateCount > 100)) {
      // Build array of all 512 channels, using updates where provided, otherwise keep current
      const currentChannels = getDmxChannels(sessionId);
      const newChannels = [...currentChannels];

      const errors: string[] = [];

      for (const [channelStr, value] of updateEntries) {
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

        newChannels[channel] = value;
      }

      // Use optimized setDmxChannels which handles OSC batching
      setDmxChannels(newChannels, sessionId);

      if (errors.length > 0) {
        log('Batch DMX update completed with errors (optimized path)', 'WARN', { updateCount, errors });
        res.status(207).json({ success: true, updateCount, sessionId, errors }); // 207 Multi-Status
      } else {
        log('Batch DMX update completed successfully (optimized path)', 'INFO', { updateCount });
        res.json({ success: true, updateCount, sessionId });
      }
      return;
    }

    // For small batches, use individual updates (but still optimized)
    let successCount = 0;
    const errors: string[] = [];

    for (const [channelStr, value] of updateEntries) {
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

      setDmxChannel(channel, value, undefined, sessionId);
      successCount++;
    }

    if (errors.length > 0) {
      log('Batch DMX update completed with errors', 'WARN', { updateCount: successCount, errors });
      res.status(207).json({ success: true, updateCount: successCount, sessionId, errors }); // 207 Multi-Status
    } else {
      log('Batch DMX update completed successfully', 'INFO', { updateCount: successCount });
      res.json({ success: true, updateCount: successCount, sessionId });
    }
  } catch (error) {
    log('Error in batch DMX update', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to update DMX channels in batch: ${error}` });
  }
};

apiRouter.post('/dmx/batch', batchDmxHandler);

// Channel range endpoint
apiRouter.post('/dmx/channel-range', (req: Request, res: Response) => {
  try {
    const { channelIndex, min, max } = req.body;

    if (typeof channelIndex !== 'number' || channelIndex < 0 || channelIndex >= 512) {
      res.status(400).json({ error: 'Invalid channel index (0-511)' });
      return;
    }

    if (typeof min !== 'number' || typeof max !== 'number') {
      res.status(400).json({ error: 'Invalid min or max value' });
      return;
    }

    const success = setChannelRange(channelIndex, min, max);

    if (success) {
      // Notify all clients
      const io = global.io;
      if (io) {
        io.emit('channelRangeUpdated', { channelIndex, min, max });
      }
      res.json({ success: true, channelIndex, min, max });
    } else {
      res.status(500).json({ error: 'Failed to set channel range' });
    }
  } catch (error) {
    log('Error setting channel range', 'ERROR', { error });
    res.status(500).json({ error: `Failed to set channel range: ${error instanceof Error ? error.message : String(error)}` });
  }
});

// MIDI Learn endpoints
const midiLearnHandler: RequestHandler = (req: Request, res: Response) => {
  try {
    const { channel } = req.body;

    if (typeof channel !== 'number') {
      res.status(400).json({ error: 'Invalid channel' });
      return;
    }

    // Emit the correct socket event that the backend is listening for
    global.io.emit('learnMidiMapping', { channel });

    res.json({ success: true });
  } catch (error) {
    log('Error starting MIDI learn', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to start MIDI learn: ${error}` });
  }
};

apiRouter.post('/midi/learn', midiLearnHandler);

apiRouter.get('/midi/active', (_req, res) => {
  res.json({ inputs: getActiveMidiInputNames() });
});

apiRouter.get('/midi/interfaces', requireLocalControlRequest, (_req, res) => {
  res.json(listMidiInterfaces());
});

apiRouter.get('/midi/auto-connect', requireLocalControlRequest, (_req, res) => {
  const config = loadConfig() as any;
  res.json({ devices: Array.isArray(config.autoConnectMidiDevices) ? config.autoConnectMidiDevices : [] });
});

apiRouter.post('/midi/server/connect', requireLocalControlRequest, async (req, res) => {
  try {
    const { inputName, remember = true } = req.body || {};
    if (typeof inputName !== 'string' || !inputName.trim()) {
      return res.status(400).json({ success: false, error: 'inputName is required' });
    }

    const trimmedInputName = inputName.trim();
    const connected = await connectMidiInput(global.io, trimmedInputName);
    if (!connected) {
      return res.status(409).json({ success: false, error: `Could not claim MIDI input "${trimmedInputName}" on the server` });
    }
    if (remember !== false) rememberMidiAutoConnectDevice(trimmedInputName);
    res.json({ success: true, active: getActiveMidiInputNames() });
  } catch (error) {
    log('Error connecting server MIDI input from API', 'ERROR', { error, body: req.body });
    res.status(500).json({ success: false, error: `Failed to connect server MIDI input: ${error instanceof Error ? error.message : String(error)}` });
  }
});

apiRouter.post('/midi/server/disconnect', requireLocalControlRequest, (req, res) => {
  try {
    const { inputName, forget = false } = req.body || {};
    if (typeof inputName !== 'string' || !inputName.trim()) {
      return res.status(400).json({ success: false, error: 'inputName is required' });
    }

    const trimmedInputName = inputName.trim();
    disconnectMidiInput(global.io, trimmedInputName);
    if (forget) forgetMidiAutoConnectDevice(trimmedInputName);
    res.json({ success: true, active: getActiveMidiInputNames() });
  } catch (error) {
    log('Error disconnecting server MIDI input from API', 'ERROR', { error, body: req.body });
    res.status(500).json({ success: false, error: `Failed to disconnect server MIDI input: ${error instanceof Error ? error.message : String(error)}` });
  }
});

apiRouter.delete('/midi/server/active', requireLocalControlRequest, (req, res) => {
  try {
    const forget = req.query.forget === 'true';
    const active = getActiveMidiInputNames();
    active.forEach((inputName) => {
      disconnectMidiInput(global.io, inputName);
      if (forget) forgetMidiAutoConnectDevice(inputName);
    });
    res.json({ success: true, disconnected: active, active: getActiveMidiInputNames() });
  } catch (error) {
    log('Error disconnecting all server MIDI inputs from API', 'ERROR', { error });
    res.status(500).json({ success: false, error: `Failed to disconnect server MIDI inputs: ${error instanceof Error ? error.message : String(error)}` });
  }
});

apiRouter.delete('/midi/auto-connect', requireLocalControlRequest, (_req, res) => {
  clearMidiAutoConnectDevices();
  res.json({ success: true, devices: [] });
});

apiRouter.post('/midi/cancel-learn', (req, res) => {
  try {
    const { channel } = req.body;

    global.io.emit('midiLearnCancelled', { channel });

    res.json({ success: true });
  } catch (error) {
    log('Error cancelling MIDI learn', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to cancel MIDI learn: ${error}` });
  }
});

apiRouter.post('/midi/mapping', (req, res) => {
  try {
    const { dmxChannel, mapping } = req.body;

    learnMidiMapping(global.io, dmxChannel, mapping);
    saveConfig();

    res.json({ success: true });
  } catch (error) {
    log('Error adding MIDI mapping', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to add MIDI mapping: ${error}` });
  }
});

apiRouter.delete('/midi/mapping/:channel', (req, res) => {
  try {
    const channel = parseInt(req.params.channel);

    // Remove the MIDI mapping for the given channel
    const config = loadConfig();
    if (config.midiMappings && channel in config.midiMappings) {
      delete config.midiMappings[channel];
    }
    saveConfig();

    res.json({ success: true });
  } catch (error) {
    log('Error removing MIDI mapping', 'ERROR', { error, params: req.params });
    res.status(500).json({ error: `Failed to remove MIDI mapping: ${error}` });
  }
});

apiRouter.delete('/midi/mappings', (req, res) => {
  try {
    // Clear all MIDI mappings
    const config = loadConfig();
    config.midiMappings = {};
    saveConfig();

    res.json({ success: true });
  } catch (error) {
    log('Error clearing all MIDI mappings', 'ERROR', { error });
    res.status(500).json({ error: `Failed to clear all MIDI mappings: ${error}` });
  }
});

apiRouter.post('/midi/controller-template', (req, res) => {
  try {
    const { templateId, deviceName } = req.body || {};
    if (templateId !== 'x_touch_mackie' && templateId !== 'apc40_mk1') {
      return res.status(400).json({
        success: false,
        error: 'Invalid templateId. Expected x_touch_mackie or apc40_mk1'
      });
    }

    const result = applyMidiControllerTemplate(global.io, templateId, typeof deviceName === 'string' ? deviceName : undefined);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log('Error applying MIDI controller template', 'ERROR', { error, body: req.body });
    res.status(500).json({ success: false, error: `Failed to apply MIDI controller template: ${error}` });
  }
});

// OSC Assignment Endpoint
apiRouter.post('/osc/assign', (req, res) => {
  try {
    const { channelIndex, channel, address } = req.body;
    // Support both channelIndex (from frontend) and channel (legacy)
    const channelNum = channelIndex !== undefined ? channelIndex : channel;

    if (typeof channelNum !== 'number' || typeof address !== 'string') {
      log('Invalid OSC assignment payload', 'ERROR', { body: req.body });
      res.status(400).json({ error: 'Invalid channel or address' });
      return;
    }

    // Call a function (to be created in index.ts) to update server-side OSC assignments
    const success = updateOscAssignment(channelNum, address);

    if (success) {
      // Logging is handled in updateOscAssignment function
      res.json({ success: true });
    } else {
      log('Failed to update OSC assignment on server', 'ERROR', { channel: channelNum, address });
      res.status(500).json({ error: 'Failed to update OSC assignment on server' });
    }
  } catch (error) {
    log('Error updating OSC assignment', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to update OSC assignment: ${error}` });
  }
});

// Legacy endpoint for backward compatibility
apiRouter.post('/osc/assignment', (req, res) => {
  try {
    const { channelIndex, channel, address } = req.body;
    // Support both channelIndex (from frontend) and channel (legacy)
    const channelNum = channelIndex !== undefined ? channelIndex : channel;

    if (typeof channelNum !== 'number' || typeof address !== 'string') {
      log('Invalid OSC assignment payload', 'ERROR', { body: req.body });
      res.status(400).json({ error: 'Invalid channel or address' });
      return;
    }

    // Call a function (to be created in index.ts) to update server-side OSC assignments
    const success = updateOscAssignment(channelNum, address);

    if (success) {
      // Logging is handled in updateOscAssignment function
      res.json({ success: true });
    } else {
      log('Failed to update OSC assignment on server', 'ERROR', { channel: channelNum, address });
      res.status(500).json({ error: 'Failed to update OSC assignment on server' });
    }
  } catch (error) {
    log('Error updating OSC assignment', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to update OSC assignment: ${error}` });
  }
});

// Scene endpoints
apiRouter.get('/scenes', (req, res) => {
  try {
    const scenes = loadScenes();
    res.json(Array.isArray(scenes) ? scenes : []);
  } catch (error) {
    log('Error loading scenes list', 'ERROR', { error });
    res.status(500).json({ error: `Failed to load scenes: ${error}` });
  }
});

apiRouter.post('/scenes', (req, res) => {
  try {
    // Support both single-scene saves and full-scene imports.
    if (Array.isArray(req.body)) {
      saveScenes(req.body);
      global.io.emit('sceneList', req.body);
      return res.json({
        success: true,
        message: 'Scenes imported successfully',
        scenesCount: req.body.length
      });
    }

    const { name, oscAddress, channelValues } = req.body;
    if (!name || !channelValues) {
      return res.status(400).json({ error: 'Scene name and channel values are required' });
    }

    saveScene(global.io, name, oscAddress, channelValues);

    return res.json({ success: true });
  } catch (error) {
    log('Error saving scene', 'ERROR', { error, body: req.body });
    return res.status(500).json({ error: `Failed to save scene: ${error}` });
  }
});

apiRouter.post('/scenes/load', (req, res) => {
  try {
    const { name } = req.body;

    loadScene(global.io, name);

    res.json({ success: true });
  } catch (error) {
    log('Error loading scene', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to load scene: ${error}` });
  }
});

apiRouter.put('/scenes/:name', (req, res) => {
  try {
    const { name } = req.params;
    const updates = req.body;

    updateScene(global.io, name, updates);

    res.json({ success: true });
  } catch (error) {
    log('Error updating scene', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to update scene: ${error}` });
  }
});

apiRouter.delete('/scenes/:name', (req, res) => {
  try {
    const { name } = req.params;

    // This function should be implemented in your index.ts file
    // It should delete the scene with the given name
    // Load scenes, filter out the one to delete, and save
    const scenes = loadScenes();
    const updatedScenes = scenes.filter((scene: any) => scene.name !== name);
    saveScenes(updatedScenes);

    global.io.emit('sceneList', updatedScenes);

    res.json({ success: true });
  } catch (error) {
    log('Error deleting scene', 'ERROR', { error, params: req.params });
    res.status(500).json({ error: `Failed to delete scene: ${error}` });
  }
});

// Clear all scenes (for factory reset)
apiRouter.delete('/scenes', (req, res) => {
  try {
    // Clear all scenes by saving an empty array
    saveScenes([]);

    // Notify all clients that scenes have been cleared
    global.io.emit('sceneList', []);
    writeFactoryResetMarker('scenes-reset');

    log('All scenes cleared via factory reset', 'INFO');
    res.json({ success: true, message: 'All scenes cleared' });
  } catch (error) {
    log('Error clearing all scenes', 'ERROR', { error });
    res.status(500).json({ error: `Failed to clear all scenes: ${error}` });
  }
});

// Config endpoints for export/import/reset flows
apiRouter.get('/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config || {});
  } catch (error) {
    log('Error loading config', 'ERROR', { error });
    res.status(500).json({ error: `Failed to load config: ${error}` });
  }
});

apiRouter.post('/config', (req, res) => {
  try {
    const configData = req.body;
    if (!configData || typeof configData !== 'object') {
      return res.status(400).json({
        error: 'Invalid config data - object expected',
        success: false
      });
    }

    const configPath = path.join(DATA_DIR, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    const reloadedConfig = loadConfig();

    global.io.emit('configUpdated', reloadedConfig);
    return res.json({
      success: true,
      message: 'Config imported successfully'
    });
  } catch (error) {
    log('Error importing config', 'ERROR', {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      error: `Failed to import config: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.delete('/config', (req, res) => {
  try {
    const configPath = path.join(DATA_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    const resetConfig = resetConfigState();
    writeFactoryResetMarker('config-reset');
    global.io.emit('configUpdated', resetConfig);

    res.json({ success: true, message: 'Configuration reset to defaults' });
  } catch (error) {
    log('Error resetting config', 'ERROR', { error });
    res.status(500).json({ error: `Failed to reset config: ${error}` });
  }
});

// Full factory reset: wipe every user-state JSON file under data/, reset the
// in-memory DMX/MIDI state, and notify all connected clients. Logs and bridge
// auth tokens are intentionally preserved (logs aren't user state; revoked
// tokens must stay revoked).
apiRouter.post('/factory-reset', (_req, res) => {
  const deleted: string[] = [];
  const failed: { file: string; error: string }[] = [];

  const safeUnlink = (filename: string) => {
    const target = path.join(DATA_DIR, filename);
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        deleted.push(filename);
      }
    } catch (error) {
      failed.push({ file: filename, error: error instanceof Error ? error.message : String(error) });
    }
  };

  try {
    [
      'config.json',
      'scenes.json',
      'acts.json',
      'fixture-data.json',
      'fixtures.json',
      'fixtures.json.backup',
      'fixture-templates.json',
      'last-state.json',
      'appearance.json',
      'all_settings.json',
      'export_config.json',
      'FIXTURE_DATA.json',
    ].forEach(safeUnlink);

    // Wipe per-fixture files saved under data/fixtures/. Fixtures live in
    // category subdirectories (data/fixtures/<Category>/<id>.json), so we
    // recurse — a flat readdir loop misses them and the next /api/state load
    // re-hydrates the rig. Keep the templates/ subtree (handled separately).
    const fixturesDir = path.join(DATA_DIR, 'fixtures');
    const templatesDirAbs = path.join(fixturesDir, 'templates');
    const wipeFixtureTree = (dir: string) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (full === templatesDirAbs) continue;
            wipeFixtureTree(full);
            try { fs.rmdirSync(full); } catch { /* non-empty or vanished */ }
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            try {
              fs.unlinkSync(full);
              deleted.push(`fixtures/${path.relative(fixturesDir, full).replace(/\\/g, '/')}`);
            } catch (error) {
              failed.push({
                file: `fixtures/${path.relative(fixturesDir, full).replace(/\\/g, '/')}`,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      } catch (error) {
        failed.push({
          file: `fixtures/${path.relative(fixturesDir, dir).replace(/\\/g, '/') || ''}`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    try {
      if (fs.existsSync(fixturesDir)) {
        wipeFixtureTree(fixturesDir);
      }
    } catch (error) {
      failed.push({
        file: 'fixtures/',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Wipe any custom fixture templates in data/fixtures/templates/
    const templatesDir = path.join(DATA_DIR, 'fixtures', 'templates');
    try {
      if (fs.existsSync(templatesDir)) {
        for (const entry of fs.readdirSync(templatesDir)) {
          if (entry.endsWith('.json')) {
            try {
              fs.unlinkSync(path.join(templatesDir, entry));
              deleted.push(`fixtures/templates/${entry}`);
            } catch (error) {
              failed.push({
                file: `fixtures/templates/${entry}`,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      }
    } catch (error) {
      failed.push({
        file: 'fixtures/templates/',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Reset in-memory state so live clients don't keep stale values
    const emptyDmx = blackoutDmxOutput();
    const resetConfig = resetConfigState();

    // Reload config + scenes + acts from disk (now empty), then notify clients
    const resetScenes = loadScenes();
    const resetActs = loadActs();

    writeFactoryResetMarker('factory-reset');

    global.io?.emit('configUpdated', resetConfig);
    global.io?.emit('sceneList', resetScenes);
    global.io?.emit('actsUpdated', resetActs);
    global.io?.emit('dmxStateRestored', { dmxChannels: emptyDmx });
    global.io?.emit('dmxBlackout', {
      dmxChannels: emptyDmx,
      channelCount: emptyDmx.length,
      reason: 'factory-reset',
      timestamp: Date.now()
    });
    global.io?.emit('fixturesLoaded', []);
    global.io?.emit('fixturesUpdated', []);
    global.io?.emit('fixtureLayoutUpdate', []);
    global.io?.emit('groupsUpdated', []);
    global.io?.emit('appearanceUpdated', null);
    global.io?.emit('factoryReset', { timestamp: Date.now() });

    log('Factory reset completed', 'INFO', {
      deletedCount: deleted.length,
      failedCount: failed.length,
    });

    res.json({
      success: true,
      message: 'Factory reset complete',
      deleted,
      failed,
    });
  } catch (error) {
    log('Error during factory reset', 'ERROR', { error });
    res.status(500).json({
      success: false,
      error: `Factory reset failed: ${error instanceof Error ? error.message : String(error)}`,
      deleted,
      failed,
    });
  }
});

apiRouter.post('/state', (req, res) => {
  try {
    const stateData = req.body;

    if (!stateData || !Array.isArray(stateData.dmxChannels)) {
      return res.status(400).json({
        error: 'Invalid state data - dmxChannels array required',
        success: false
      });
    }

    setDmxChannels(stateData.dmxChannels);

    const statePath = path.join(DATA_DIR, 'last-state.json');
    const stateToSave = {
      timestamp: new Date().toISOString(),
      dmxChannels: stateData.dmxChannels,
      savedOn: 'imported-state'
    };
    fs.writeFileSync(statePath, JSON.stringify(stateToSave, null, 2));

    global.io.emit('dmxStateRestored', { dmxChannels: stateData.dmxChannels });

    res.json({
      success: true,
      message: 'State imported successfully',
      channelsImported: stateData.dmxChannels.filter((val: number) => val > 0).length
    });
  } catch (error) {
    log('Error importing state', 'ERROR', {
      message: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      error: `Failed to import state: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.delete('/state', (req, res) => {
  try {
    const emptyState = new Array(512).fill(0);
    setDmxChannels(emptyState);
    const statePath = path.join(DATA_DIR, 'last-state.json');
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    writeFactoryResetMarker('state-reset');
    global.io.emit('dmxStateRestored', { dmxChannels: emptyState });
    res.json({ success: true, message: 'DMX state reset' });
  } catch (error) {
    log('Error resetting state', 'ERROR', { error });
    res.status(500).json({ error: `Failed to reset state: ${error}` });
  }
});

// ArtNet configuration
apiRouter.post('/config/artnet', (req, res) => {
  try {
    const artNetConfig = req.body;

    // Update ArtNet configuration
    const config = loadConfig();
    config.artNetConfig = { ...config.artNetConfig, ...artNetConfig };
    saveConfig();

    res.json({ success: true });
  } catch (error) {
    log('Error updating ArtNet config', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to update ArtNet config: ${error}` });
  }
});

// GET /api/shows/:id - Return raw show preset YAML from data/shows/
apiRouter.get('/shows/:id', (req, res) => {
  try {
    const id = req.params.id.replace(/[^a-z0-9-]/gi, '');
    if (!id) {
      res.status(400).json({ error: 'Invalid show id' });
      return;
    }
    const filePath = path.join(DATA_DIR, 'shows', `${id}.yaml`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Show '${id}' not found` });
      return;
    }
    res.type('text/yaml').send(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    log('Error loading show preset', 'ERROR', { error, params: req.params });
    res.status(500).json({ error: `Failed to load show: ${error}` });
  }
});

// Fixtures endpoints
// POST /api/fixtures - Save all fixtures (for bulk operations, still supported)
apiRouter.post('/fixtures', (req, res) => {
  try {
    const { fixtures, fixtureLayout, groups, masterSliders } = req.body;
    if (!Array.isArray(fixtures)) {
      res.status(400).json({ error: 'Fixtures must be an array' });
      return;
    }

    // Load current fixtures to detect changes
    const currentData = loadFixturesData();
    const previousCount = currentData.fixtures.length;
    const newCount = fixtures.length;
    const addedCount = newCount > previousCount ? newCount - previousCount : 0;
    const removedCount = previousCount > newCount ? previousCount - newCount : 0;

    const nextFixturesData = {
      ...currentData,
      fixtures
    };
    if (Array.isArray(fixtureLayout)) {
      nextFixturesData.fixtureLayout = fixtureLayout;
    }
    if (Array.isArray(groups)) {
      nextFixturesData.groups = groups;
    }
    if (Array.isArray(masterSliders)) {
      nextFixturesData.masterSliders = masterSliders;
    }

    saveFixturesData(nextFixturesData);

    // Update server's in-memory fixtures to keep them in sync
    try {
      saveFixtures(fixtures);
      log('Server fixtures updated', 'INFO', { fixtures: fixtures.length });
    } catch (error) {
      log('Warning: Failed to update server fixtures', 'WARN', { error });
    }
    
    // Log fixture changes
    if (addedCount > 0) {
      const newFixtures = fixtures.slice(previousCount);
      newFixtures.forEach((fixture: any) => {
        log('Fixture added', 'INFO', { 
          name: fixture.name, 
          address: fixture.startAddress, 
          channels: fixture.channels?.length || 0,
          type: fixture.type || 'generic'
        });
      });
    }
    if (removedCount > 0) {
      log('Fixtures removed', 'INFO', { count: removedCount });
    }
    
    log('Fixtures saved', 'INFO', { 
      total: fixtures.length, 
      added: addedCount,
      removed: removedCount
    });
    
    // Notify all clients of the fixtures update (emit both for compatibility)
    global.io.emit('fixturesUpdate', fixtures);
    global.io.emit('fixturesUpdated', fixtures);
    if (Array.isArray(fixtureLayout)) {
      global.io.emit('fixtureLayoutUpdate', fixtureLayout);
    }
    if (Array.isArray(groups)) {
      global.io.emit('groupsUpdate', groups);
    }
    res.json({ success: true });
  } catch (error) {
    log('Error saving fixtures', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to save fixtures: ${error}` });
  }
});

// POST /api/fixtures/:id - Save a single fixture
apiRouter.post('/fixtures/:id', (req, res) => {
  try {
    const fixtureId = req.params.id;
    const fixture = req.body;
    
    if (!fixture || !fixture.id || fixture.id !== fixtureId) {
      res.status(400).json({ error: 'Fixture ID mismatch' });
      return;
    }

    const success = saveFixtureFile(fixture);
    
    if (success) {
      // Reload all fixtures and broadcast update
      const fixturesData = loadFixturesData();
      global.io.emit('fixturesUpdated', fixturesData.fixtures);
      log('Fixture saved', 'INFO', { fixtureId, name: fixture.name });
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save fixture' });
    }
  } catch (error) {
    log('Error saving fixture', 'ERROR', { error, fixtureId: req.params.id });
    res.status(500).json({ error: `Failed to save fixture: ${error}` });
  }
});

// DELETE /api/fixtures/:id - Delete a single fixture
apiRouter.delete('/fixtures/:id', (req, res) => {
  try {
    const fixtureId = req.params.id;
    const success = deleteFixtureFile(fixtureId);
    
    if (success) {
      // Reload all fixtures and broadcast update
      const fixturesData = loadFixturesData();
      global.io.emit('fixturesUpdated', fixturesData.fixtures);
      log('Fixture deleted', 'INFO', { fixtureId });
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete fixture' });
    }
  } catch (error) {
    log('Error deleting fixture', 'ERROR', { error, fixtureId: req.params.id });
    res.status(500).json({ error: `Failed to delete fixture: ${error}` });
  }
});

// Fixture templates endpoints
apiRouter.get('/fixture-templates', (req, res) => {
  try {
    const templates = loadFixtureTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    log('Error loading fixture templates', 'ERROR', { error });
    res.status(500).json({ error: `Failed to load fixture templates: ${error}` });
  }
});

apiRouter.post('/fixture-templates', (req, res) => {
  try {
    const { templates } = req.body;
    if (!Array.isArray(templates)) {
      res.status(400).json({ error: 'Templates must be an array' });
      return;
    }
    
    const success = saveFixtureTemplates(templates);
    
    if (success) {
      // Broadcast to all clients
      global.io.emit('fixtureTemplatesUpdated', templates);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save fixture templates' });
    }
  } catch (error) {
    log('Error saving fixture templates', 'ERROR', { error });
    res.status(500).json({ error: `Failed to save fixture templates: ${error}` });
  }
});

apiRouter.post('/groups', (req, res) => {
  try {
    const { groups } = req.body;

    const fixtureData = loadFixturesData();
    const fixtures = fixtureData.fixtures || [];
    const normalized = Array.isArray(groups)
      ? groups.map((group: any) => {
          const indices: number[] = Array.isArray(group?.fixtureIndices) ? group.fixtureIndices : [];
          const ids: string[] = Array.isArray(group?.fixtureIds) && group.fixtureIds.length
            ? group.fixtureIds.slice()
            : indices.map((idx: number) => fixtures[idx]?.id).filter((id: string | undefined) => Boolean(id)) as string[];
          return { ...group, fixtureIds: ids };
        })
      : groups;
    fixtureData.groups = normalized;
    const success = saveFixturesData(fixtureData);

    if (success) {
      global.io.emit('groupsUpdate', normalized);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save groups data' });
    }
  } catch (error) {
    log('Error saving groups', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to save groups: ${error}` });
  }
});

apiRouter.post('/fixture-layout', (req, res) => {
  try {
    const { fixtureLayout } = req.body;

    // Load current fixtures data
    const fixturesData = loadFixturesData();
    fixturesData.fixtureLayout = fixtureLayout;

    // Save updated fixtures data
    const success = saveFixturesData(fixturesData);

    if (success) {
      // Notify all clients of the fixture layout update
      global.io.emit('fixtureLayoutUpdate', fixtureLayout);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save fixture layout data' });
    }
  } catch (error) {
    log('Error saving fixture layout', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to save fixture layout: ${error}` });
  }
});

apiRouter.post('/master-sliders', (req, res) => {
  try {
    const { masterSliders } = req.body;

    // Load current fixtures data
    const fixturesData = loadFixturesData();
    fixturesData.masterSliders = masterSliders;

    // Save updated fixtures data
    const success = saveFixturesData(fixturesData);

    if (success) {
      // Notify all clients of the master sliders update
      global.io.emit('masterSlidersUpdate', masterSliders);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save master sliders data' });
    }
  } catch (error) {
    log('Error saving master sliders', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to save master sliders: ${error}` });
  }
});

// Export all settings
apiRouter.post('/export', (req, res) => {
  try {
    const config = loadConfig();
    const scenes = loadScenes();
    const fixturesData = loadFixturesData();

    const allSettings = {
      config,
      scenes,
      fixtures: fixturesData.fixtures,
      groups: fixturesData.groups,
      fixtureLayout: fixturesData.fixtureLayout,
      masterSliders: fixturesData.masterSliders
    };

    fs.writeFileSync(EXPORT_FILE, JSON.stringify(allSettings, null, 2));

    res.json({ success: true, filePath: EXPORT_FILE });
  } catch (error) {
    log('Error exporting settings', 'ERROR', { error });
    res.status(500).json({ error: `Failed to export settings: ${error}` });
  }
});

// Import settings
const importHandler: RequestHandler = (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(EXPORT_FILE)) {
      res.status(404).json({ error: 'Export file not found' });
      return;
    }

    const data = fs.readFileSync(EXPORT_FILE, 'utf-8');
    const allSettings = JSON.parse(data);

    // Apply imported settings
    if (allSettings.config) {
      // Use the current config as a base and update it
      const config = loadConfig();
      Object.assign(config, allSettings.config);
      saveConfig();
    }

    if (allSettings.scenes) {
      saveScenes(allSettings.scenes);
    }

    // Import fixtures data if present
    if (allSettings.fixtures || allSettings.groups || allSettings.fixtureLayout || allSettings.masterSliders) {
      const currentFixturesData = loadFixturesData();
      const updatedFixturesData = {
        fixtures: allSettings.fixtures || currentFixturesData.fixtures,
        groups: allSettings.groups || currentFixturesData.groups,
        fixtureLayout: allSettings.fixtureLayout || currentFixturesData.fixtureLayout,
        masterSliders: allSettings.masterSliders || currentFixturesData.masterSliders
      };
      saveFixturesData(updatedFixturesData);

      // Notify clients of fixtures data updates
      global.io.emit('fixturesUpdate', updatedFixturesData.fixtures);
      global.io.emit('groupsUpdate', updatedFixturesData.groups);
      global.io.emit('fixtureLayoutUpdate', updatedFixturesData.fixtureLayout);
      global.io.emit('masterSlidersUpdate', updatedFixturesData.masterSliders);
    }

    // Notify clients
    global.io.emit('configUpdate', allSettings.config);
    global.io.emit('sceneList', allSettings.scenes);

    res.json({ success: true, settings: allSettings });
  } catch (error) {
    log('Error importing settings', 'ERROR', { error });
    res.status(500).json({ error: `Failed to import settings: ${error}` });
  }
};

apiRouter.post('/import', importHandler);

// ============================================================================
// Project YAML round-trip (per-section export/import). Pretty, hand-editable
// YAML; same loaders/savers as the JSON paths above so writes go through one
// place. Sections: fixtures, groups, scenes, acts, bindings.
// ============================================================================
import { stringify as yamlStringify, parse as yamlParse } from 'yaml';

type ProjectSection = 'fixtures' | 'groups' | 'scenes' | 'acts' | 'bindings' | 'config' | 'layout';
const PROJECT_SECTIONS: ProjectSection[] = ['fixtures', 'groups', 'scenes', 'acts', 'bindings', 'config', 'layout'];

function buildSectionYaml(section: ProjectSection): string {
  const opts = { indent: 2, lineWidth: 0 } as const;
  if (section === 'fixtures') {
    const fx = loadFixturesData();
    return yamlStringify({ fixtures: fx.fixtures }, opts);
  }
  if (section === 'groups') {
    const fx = loadFixturesData();
    const groups = (fx.groups || []).map((g: any) => {
      const fixtureIds = Array.isArray(g.fixtureIds) && g.fixtureIds.length
        ? g.fixtureIds
        : (g.fixtureIndices || []).map((idx: number) => fx.fixtures[idx]?.id).filter(Boolean);
      return { ...g, fixtureIds };
    });
    return yamlStringify({ groups }, opts);
  }
  if (section === 'scenes') return yamlStringify({ scenes: loadScenes() }, opts);
  if (section === 'acts') return yamlStringify({ acts: loadActs() }, opts);
  if (section === 'bindings') {
    const config = loadConfig();
    return yamlStringify({ midiMappings: config.midiMappings || {} }, opts);
  }
  if (section === 'config') {
    const configPath = path.join(DATA_DIR, 'config.json');
    const raw = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      : {};
    const { midiMappings: _drop, ...rest } = raw;
    return yamlStringify({ config: rest }, opts);
  }
  if (section === 'layout') {
    const fx = loadFixturesData();
    return yamlStringify({
      fixtureLayout: fx.fixtureLayout || [],
      masterSliders: fx.masterSliders || [],
    }, opts);
  }
  throw new Error(`unknown section: ${section}`);
}

apiRouter.get('/project/export', (req, res) => {
  try {
    const section = String(req.query.section || '') as ProjectSection;
    if (!PROJECT_SECTIONS.includes(section)) {
      res.status(400).json({ error: `section must be one of: ${PROJECT_SECTIONS.join(', ')}` });
      return;
    }
    res.type('text/yaml').send(buildSectionYaml(section));
  } catch (error) {
    log('project/export failed', 'ERROR', { error });
    res.status(500).json({ error: String(error) });
  }
});

apiRouter.get('/project/export/bundle', (_req, res) => {
  try {
    const bundle: Record<string, string> = {};
    for (const section of PROJECT_SECTIONS) bundle[section] = buildSectionYaml(section);
    res.json(bundle);
  } catch (error) {
    log('project/export/bundle failed', 'ERROR', { error });
    res.status(500).json({ error: String(error) });
  }
});

apiRouter.post('/project/import', (req, res) => {
  try {
    const { section, yamlText } = req.body || {};
    if (!PROJECT_SECTIONS.includes(section)) {
      res.status(400).json({ error: `section must be one of: ${PROJECT_SECTIONS.join(', ')}` });
      return;
    }
    if (typeof yamlText !== 'string' || !yamlText.trim()) {
      res.status(400).json({ error: 'yamlText is required' });
      return;
    }
    const parsed: any = yamlParse(yamlText);
    const warnings: string[] = [];
    let applied = 0;

    if (section === 'fixtures') {
      const list = Array.isArray(parsed?.fixtures) ? parsed.fixtures : null;
      if (!list) throw new Error('expected top-level "fixtures" list');
      const fx = loadFixturesData();
      fx.fixtures = list;
      saveFixturesData(fx);
      global.io.emit('fixturesUpdate', fx.fixtures);
      applied = list.length;
    } else if (section === 'groups') {
      const list = Array.isArray(parsed?.groups) ? parsed.groups : null;
      if (!list) throw new Error('expected top-level "groups" list');
      const fx = loadFixturesData();
      const fixtureIdToIndex = new Map(fx.fixtures.map((f: any, i: number) => [f.id, i]));
      fx.groups = list.map((g: any) => {
        const ids = Array.isArray(g.fixtureIds) ? g.fixtureIds.map(String) : [];
        const resolvedIds: string[] = [];
        const resolvedIndices: number[] = [];
        ids.forEach((id: string) => {
          const idx = fixtureIdToIndex.get(id);
          if (idx === undefined) {
            warnings.push(`group "${g.name}": fixtureId "${id}" not found — dropped`);
            return;
          }
          resolvedIds.push(id);
          resolvedIndices.push(idx);
        });
        return { ...g, fixtureIds: resolvedIds, fixtureIndices: resolvedIndices };
      });
      saveFixturesData(fx);
      global.io.emit('groupsUpdate', fx.groups);
      applied = list.length;
    } else if (section === 'scenes') {
      const list = Array.isArray(parsed?.scenes) ? parsed.scenes : null;
      if (!list) throw new Error('expected top-level "scenes" list');
      saveScenes(list);
      global.io.emit('sceneList', list);
      applied = list.length;
    } else if (section === 'acts') {
      const list = Array.isArray(parsed?.acts) ? parsed.acts : null;
      if (!list) throw new Error('expected top-level "acts" list');
      saveActs(list);
      global.io.emit('actsUpdate', list);
      applied = list.length;
    } else if (section === 'bindings') {
      if (!parsed?.midiMappings || typeof parsed.midiMappings !== 'object') {
        throw new Error('expected top-level "midiMappings" map');
      }
      const config = loadConfig();
      config.midiMappings = parsed.midiMappings;
      saveConfig();
      global.io.emit('midiMappingsUpdate', config.midiMappings);
      applied = Object.keys(parsed.midiMappings).length;
    } else if (section === 'config') {
      const incoming = parsed?.config;
      if (!incoming || typeof incoming !== 'object') {
        throw new Error('expected top-level "config" object');
      }
      const configPath = path.join(DATA_DIR, 'config.json');
      const existing = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        : {};
      const merged = { ...existing, ...incoming, midiMappings: existing.midiMappings || {} };
      fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
      const reloaded = loadConfig();
      global.io.emit('configUpdated', reloaded);
      applied = Object.keys(incoming).length;
    } else if (section === 'layout') {
      const fx = loadFixturesData();
      if (Array.isArray(parsed?.fixtureLayout)) {
        fx.fixtureLayout = parsed.fixtureLayout;
      }
      if (Array.isArray(parsed?.masterSliders)) {
        fx.masterSliders = parsed.masterSliders;
      }
      saveFixturesData(fx);
      global.io.emit('fixtureLayoutUpdate', fx.fixtureLayout);
      global.io.emit('masterSlidersUpdate', fx.masterSliders);
      applied = (fx.fixtureLayout?.length || 0) + (fx.masterSliders?.length || 0);
    }

    res.json({ success: true, applied, warnings });
  } catch (error) {
    log('project/import failed', 'ERROR', { error });
    res.status(400).json({ error: String(error) });
  }
});

// Ping ArtNet device
apiRouter.post('/ping-artnet', (req, res) => {
  try {
    const { ip } = req.body;

    pingArtNetDevice(global.io, ip);

    res.json({ success: true });
  } catch (error) {
    log('Error pinging ArtNet device', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to ping ArtNet device: ${error}` });
  }
});

function registerApiSocketHandlers(io: Server, socket: any) {
  // Send initial state including fixtures
  const fixturesData = loadFixturesData();
  const config = loadConfig();
  const scenes = loadScenes();
  const acts = loadActs();
  
  socket.emit('initialState', {
    fixtures: fixturesData.fixtures,
    groups: fixturesData.groups,
    scenes,
    acts,
    midiMappings: config.midiMappings || {},
    artNetConfig: config.artNetConfig,
    oscConfig: config.oscConfig,
    dmxChannels: getDmxChannels(),
    oscAssignments: [], // Will be populated from config if needed
    channelNames: getChannelNames ? getChannelNames() : [],
    fixtureTemplates: loadFixtureTemplates()
  });
  
  // Also send fixtures separately for compatibility
  socket.emit('fixturesLoaded', fixturesData.fixtures);
  socket.emit('fixturesUpdate', fixturesData.fixtures);
  socket.emit('fixturesUpdated', fixturesData.fixtures);
  
  log('Sent initial state to client', 'INFO', { 
    socketId: socket.id, 
    fixtures: fixturesData.fixtures.length,
    groups: fixturesData.groups.length,
    scenes: scenes.length
  });
    // Handle settings export
    socket.on('exportSettings', () => {
      try {
        const config = loadConfig();
        const scenes = loadScenes();
        const fixturesData = loadFixturesData();

        const allSettings = {
          config,
          scenes,
          fixtures: fixturesData.fixtures,
          groups: fixturesData.groups,
          fixtureLayout: fixturesData.fixtureLayout,
          masterSliders: fixturesData.masterSliders
        };

        fs.writeFileSync(EXPORT_FILE, JSON.stringify(allSettings, null, 2));

        socket.emit('settingsExported', EXPORT_FILE);
      } catch (error) {
        log('Error exporting settings via socket', 'ERROR', { error, socketId: socket.id });
        socket.emit('exportError', error instanceof Error ? error.message : String(error));
      }
    });
    // Handle settings import
    socket.on('importSettings', () => {
      try {
        if (!fs.existsSync(EXPORT_FILE)) {
          socket.emit('importError', 'Export file not found');
          return;
        }

        const data = fs.readFileSync(EXPORT_FILE, 'utf-8');
        const allSettings = JSON.parse(data);

        // Apply imported settings
        if (allSettings.config) {
          // Use the current config as a base and update it
          const config = loadConfig();
          Object.assign(config, allSettings.config);
          saveConfig();
        }

        if (allSettings.scenes) {
          saveScenes(allSettings.scenes);
        }

        // Import fixtures data if present
        if (allSettings.fixtures || allSettings.groups || allSettings.fixtureLayout || allSettings.masterSliders) {
          const currentFixturesData = loadFixturesData();
          const updatedFixturesData = {
            fixtures: allSettings.fixtures || currentFixturesData.fixtures,
            groups: allSettings.groups || currentFixturesData.groups,
            fixtureLayout: allSettings.fixtureLayout || currentFixturesData.fixtureLayout,
            masterSliders: allSettings.masterSliders || currentFixturesData.masterSliders
          };
          saveFixturesData(updatedFixturesData);

          // Notify clients of fixtures data updates
          io.emit('fixturesUpdate', updatedFixturesData.fixtures);
          io.emit('groupsUpdate', updatedFixturesData.groups);
          io.emit('fixtureLayoutUpdate', updatedFixturesData.fixtureLayout);
          io.emit('masterSlidersUpdate', updatedFixturesData.masterSliders);
        }

        // Notify clients
        io.emit('configUpdate', allSettings.config);
        io.emit('sceneList', allSettings.scenes);

        socket.emit('settingsImported', allSettings);
      } catch (error) {
        log('Error importing settings via socket', 'ERROR', { error, socketId: socket.id });
        socket.emit('importError', error instanceof Error ? error.message : String(error));
      }
    });

    // Handle sending OSC messages
    socket.on('sendOsc', (message) => {
      try {
        // This function should be implemented in your index.ts file
        // It should send an OSC message with the given address and args
        // Support custom host/port for Face Tracker and other custom OSC sending
        sendOscMessage(message.address, message.args, message.host, message.port);

        // Forward OSC message to all clients for display
        io.emit('oscMessage', {
          ...message,
          timestamp: Date.now()
        });
      } catch (error) {
        log('Error sending OSC message via socket', 'ERROR', { error, message, socketId: socket.id });
        socket.emit('error', `Failed to send OSC message: ${error}`);
      }
    });

    // Handle OSC configuration changes
    socket.on('saveOscConfig', (oscConfig) => {
      try {
        log('Received OSC config update via socket', 'OSC', { oscConfig, socketId: socket.id });

        // Update OSC configuration
        updateOscConfig(io, oscConfig);

        // Notify all clients of the configuration change
        io.emit('oscConfigUpdate', oscConfig);

        socket.emit('oscConfigSaved', { success: true });
      } catch (error) {
        log('Error updating OSC config via socket', 'ERROR', { error, oscConfig, socketId: socket.id });
        socket.emit('oscConfigSaved', {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Handle ArtNet ping
    socket.on('pingArtNet', (ip) => {
      pingArtNetDevice(io, ip);
    });

}

// Import sendOscMessage from index.ts
import { sendOscMessage } from './index';

// Network interface detection endpoint
apiRouter.get('/test-network-interface', async (req, res) => {
  try {
    const targetIp = '192.168.1.199';
    const interfaces = os.networkInterfaces();
    const suitableInterfaces: Array<{ name: string; address: string; canPing: boolean }> = [];

    // Test each interface
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      
      for (const addr of addrs) {
        // Skip internal/localhost interfaces
        if (addr.internal || addr.family !== 'IPv4') continue;
        
        // Try to ping the target IP from this interface
        let canPing = false;
        try {
          // Use ping command to test connectivity
          const { stdout } = await execAsync(`ping -c 1 -W 1 ${targetIp}`, { timeout: 2000 });
          canPing = stdout.includes('1 received') || stdout.includes('1 packets received');
        } catch (error) {
          canPing = false;
        }
        
        suitableInterfaces.push({
          name: name,
          address: addr.address,
          canPing: canPing
        });
      }
    }

    // Find the best interface (one that can ping, or just any USB/Ethernet adapter)
    const bestInterface = suitableInterfaces.find(i => i.canPing) || 
                         suitableInterfaces.find(i => i.name.toLowerCase().includes('usb') || 
                                                      i.name.toLowerCase().includes('ethernet') ||
                                                      i.name.toLowerCase().includes('eth')) ||
                         suitableInterfaces[0];

    if (bestInterface) {
      res.json({
        success: true,
        interface: bestInterface,
        allInterfaces: suitableInterfaces
      });
    } else {
      res.json({
        success: false,
        message: 'No suitable network interface found. Check USB Ethernet adapter.',
        allInterfaces: suitableInterfaces
      });
    }
  } catch (error) {
    log('Error detecting network interface', 'ERROR', { error });
    res.status(500).json({
      error: `Failed to detect network interface: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.get('/sessions', (_req, res) => {
  res.json(getSessionsOverview());
});

apiRouter.post('/sessions', (req, res) => {
  try {
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : 'New session';
    const session = createSession(name);
    res.json({ success: true, session });
  } catch (error) {
    log('Error creating session', 'ERROR', { error });
    res.status(500).json({ error: 'Failed to create session' });
  }
});

apiRouter.get('/bridge/status', (req, res) => {
  const sessionId = resolveSessionIdFromRequest(req);
  ensureSession(sessionId);
  res.json(getBridgeStatusPayload(sessionId));
});

apiRouter.post('/bridge/token', (req, res) => {
  try {
    const bridgeId =
      typeof req.body?.bridgeId === 'string' && req.body.bridgeId.trim()
        ? req.body.bridgeId.trim()
        : `bridge-${Date.now()}`;
    const sessionId =
      typeof req.body?.sessionId === 'string' && req.body.sessionId.trim()
        ? req.body.sessionId.trim().slice(0, 64)
        : DEFAULT_SESSION_ID;
    ensureSession(sessionId);
    const expiresInSec =
      typeof req.body?.expiresInSec === 'number' ? req.body.expiresInSec : 60 * 60 * 24 * 30;
    const token = mintBridgeToken(bridgeId, sessionId, expiresInSec);
    res.json({
      success: true,
      bridgeId,
      sessionId,
      token,
      tokenHint: hashTokenForDisplay(token),
      expiresInSec,
    });
  } catch (error) {
    log('Error minting bridge token', 'ERROR', { error });
    res.status(500).json({ error: 'Failed to mint bridge token' });
  }
});

apiRouter.post('/bridge/token/revoke', (req, res) => {
  const token = req.body?.token;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token required' });
    return;
  }
  revokeBridgeToken(token);
  res.json({ success: true });
});

const APPEARANCE_FILE = path.join(DATA_DIR, 'appearance.json');

const loadAppearance = (): Record<string, unknown> => {
  try {
    if (fs.existsSync(APPEARANCE_FILE)) {
      return JSON.parse(fs.readFileSync(APPEARANCE_FILE, 'utf-8'));
    }
  } catch (error) {
    log('Failed to load appearance.json', 'WARN', { error });
  }
  return {};
};

const saveAppearance = (data: Record<string, unknown>): boolean => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(APPEARANCE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    log('Failed to save appearance.json', 'ERROR', { error });
    return false;
  }
};

apiRouter.get('/appearance', (_req, res) => {
  res.json(loadAppearance());
});

apiRouter.post('/appearance', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const merged = { ...loadAppearance(), ...body, updatedAt: Date.now() };
  if (!saveAppearance(merged)) {
    res.status(500).json({ error: 'Failed to save appearance' });
    return;
  }
  global.io?.emit('appearanceUpdated', merged);
  res.json({ success: true, appearance: merged });
});

export { apiRouter, registerApiSocketHandlers, loadFixturesData };
