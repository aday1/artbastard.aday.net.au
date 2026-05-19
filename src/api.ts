import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from './logger';

const execAsync = promisify(exec);
import {
  setDmxChannel,
  setDmxChannels,
  learnMidiMapping,
  loadScene,
  saveScene,
  updateScene,
  loadConfig,
  saveConfig,
  clearMidiMappings,
  loadScenes,
  saveScenes,
  loadActs,
  saveActs,
  pingArtNetDevice,
  updateArtNetConfig,
  updateOscAssignment,
  updateOscConfig, // Added import
  getDmxChannels, // Added import
  getChannelNames, // Added import
  getChannelRanges, // Added import
  setChannelRange, // Added import
  saveFixtures, // Added import to sync server fixtures
  loadFixtures // Added import to reload fixtures
} from './index';
import { FaceTrackerService } from './faceTrackerService';

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXPORT_FILE = path.join(DATA_DIR, 'all_settings.json');

// Cache for last generated TouchOSC layout
let lastTouchOscLayout: Buffer | null = null;
let lastTouchOscXml: string | null = null;

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
apiRouter.use(express.json());

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
    artnetStatus: (global as any).artNetPingStatus || 'unknown'
  };

  const isHealthy = stats.serverStatus === 'healthy';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    ...stats
  });
});

// Serve cached TouchOSC layout
// Helper to serve the layout on a second port if requested
try {
  const collectionApp = express();
  collectionApp.get('/layout.tosc', (req, res) => {
    if (lastTouchOscLayout) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="ArtBastard_Ultimate.tosc"');
      res.send(lastTouchOscLayout);
    } else {
      res.status(404).json({ error: 'No layout generated yet.' });
    }
  });

  // Specific endpoint for TouchOSC Editor network collection (often looks for index.xml or similar)
  collectionApp.get('/index.xml', (req, res) => {
    if (lastTouchOscXml) {
      res.setHeader('Content-Type', 'text/xml');
      res.send(lastTouchOscXml);
    } else {
      res.status(404).send('No XML generated yet.');
    }
  });

  collectionApp.listen(6666, '0.0.0.0', () => {
    log('TouchOSC collection server listening on port 6666', 'TOUCHOSC');
  });
} catch (err) {
  log('Could not start TouchOSC collection server on port 6666', 'WARN', { error: err });
}

apiRouter.get('/touchosc/layout.tosc', (req, res) => {
  if (lastTouchOscLayout) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="ArtBastard_Ultimate.tosc"');
    res.send(lastTouchOscLayout);
  } else {
    res.status(404).json({ error: 'No layout generated yet. Please click export in the app first.' });
  }
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

    // Read the log file content
    const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
    res.type('text/plain').send(logContent);
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

// Helper functions for fixtures data
// New format: Each fixture in its own file in data/fixtures/ directory
const FIXTURES_DIR = path.join(DATA_DIR, 'fixtures');
const FIXTURE_DATA_FILE = path.join(DATA_DIR, 'fixture-data.json'); // For groups, layout, masterSliders

// Ensure fixtures directory exists
const ensureFixturesDir = () => {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
};

// Save a single fixture to its own file
const saveFixtureFile = (fixture: any) => {
  try {
    ensureFixturesDir();
    const fixtureFile = path.join(FIXTURES_DIR, `${fixture.id}.json`);
    fs.writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2));
    return true;
  } catch (error) {
    log('Error saving fixture file', 'ERROR', { error, fixtureId: fixture?.id });
    return false;
  }
};

// Delete a fixture file
const deleteFixtureFile = (fixtureId: string) => {
  try {
    const fixtureFile = path.join(FIXTURES_DIR, `${fixtureId}.json`);
    if (fs.existsSync(fixtureFile)) {
      fs.unlinkSync(fixtureFile);
      return true;
    }
    return true; // File doesn't exist, consider it deleted
  } catch (error) {
    log('Error deleting fixture file', 'ERROR', { error, fixtureId });
    return false;
  }
};

// Load a single fixture from file
const loadFixtureFile = (fixtureId: string) => {
  try {
    const fixtureFile = path.join(FIXTURES_DIR, `${fixtureId}.json`);
    if (fs.existsSync(fixtureFile)) {
      const data = fs.readFileSync(fixtureFile, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    log('Error loading fixture file', 'ERROR', { error, fixtureId });
    return null;
  }
};

// Load all fixtures from individual files
const loadAllFixtures = (): any[] => {
  try {
    ensureFixturesDir();
    const fixtures: any[] = [];
    
    if (!fs.existsSync(FIXTURES_DIR)) {
      return fixtures;
    }
    
    const files = fs.readdirSync(FIXTURES_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(FIXTURES_DIR, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const fixture = JSON.parse(data);
          if (fixture && fixture.id) {
            fixtures.push(fixture);
          }
        } catch (error) {
          log('Error loading fixture file', 'WARN', { error, file });
        }
      }
    }
    
    return fixtures;
  } catch (error) {
    log('Error loading fixtures directory', 'ERROR', { error });
    return [];
  }
};

// Migrate from old fixtures.json format to individual files
const migrateOldFixturesFormat = () => {
  try {
    const oldFixturesPath = path.join(DATA_DIR, 'fixtures.json');
    if (!fs.existsSync(oldFixturesPath)) {
      return; // No old file to migrate
    }
    
    const data = fs.readFileSync(oldFixturesPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Check if it's the old format with fixtures array
    if (parsed && Array.isArray(parsed.fixtures) && parsed.fixtures.length > 0) {
      log('Migrating fixtures from old format to individual files', 'INFO', { count: parsed.fixtures.length });
      ensureFixturesDir();
      
      // Save each fixture to its own file
      for (const fixture of parsed.fixtures) {
        if (fixture && fixture.id) {
          saveFixtureFile(fixture);
        }
      }
      
      // Save groups, layout, and masterSliders to fixture-data.json
      const fixtureData = {
        groups: parsed.groups || [],
        fixtureLayout: parsed.fixtureLayout || [],
        masterSliders: parsed.masterSliders || []
      };
      fs.writeFileSync(FIXTURE_DATA_FILE, JSON.stringify(fixtureData, null, 2));
      
      // Rename old file as backup
      const backupPath = path.join(DATA_DIR, 'fixtures.json.backup');
      if (!fs.existsSync(backupPath)) {
        fs.renameSync(oldFixturesPath, backupPath);
        log('Old fixtures.json backed up', 'INFO');
      }
    }
  } catch (error) {
    log('Error migrating fixtures format', 'ERROR', { error });
  }
};

// Load fixture data (groups, layout, masterSliders)
const loadFixtureData = () => {
  try {
    if (fs.existsSync(FIXTURE_DATA_FILE)) {
      const data = fs.readFileSync(FIXTURE_DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return {
      groups: [],
      fixtureLayout: [],
      masterSliders: []
    };
  } catch (error) {
    log('Error loading fixture data', 'ERROR', { error });
    return {
      groups: [],
      fixtureLayout: [],
      masterSliders: []
    };
  }
};

// Save fixture data (groups, layout, masterSliders)
const saveFixtureData = (data: { groups?: any[], fixtureLayout?: any[], masterSliders?: any[] }) => {
  try {
    const fixtureData = {
      groups: data.groups || [],
      fixtureLayout: data.fixtureLayout || [],
      masterSliders: data.masterSliders || []
    };
    fs.writeFileSync(FIXTURE_DATA_FILE, JSON.stringify(fixtureData, null, 2));
    return true;
  } catch (error) {
    log('Error saving fixture data', 'ERROR', { error });
    return false;
  }
};

export const loadFixturesData = () => {
  try {
    // Migrate from old format if needed (only once)
    migrateOldFixturesFormat();
    
    // Load fixtures from individual files
    const fixtures = loadAllFixtures();
    
    // Load groups, layout, and masterSliders
    const fixtureData = loadFixtureData();
    
    return {
      fixtures,
      groups: fixtureData.groups || [],
      fixtureLayout: fixtureData.fixtureLayout || [],
      masterSliders: fixtureData.masterSliders || []
    };
  } catch (error) {
    log('Error loading fixtures data', 'ERROR', { error });
    return {
      fixtures: [],
      groups: [],
      fixtureLayout: [],
      masterSliders: []
    };
  }
};

const saveFixturesData = (data: any) => {
  try {
    // Save each fixture to its own file
    if (Array.isArray(data.fixtures)) {
      ensureFixturesDir();
      for (const fixture of data.fixtures) {
        if (fixture && fixture.id) {
          saveFixtureFile(fixture);
        }
      }
    }
    
    // Save groups, layout, and masterSliders
    saveFixtureData({
      groups: data.groups,
      fixtureLayout: data.fixtureLayout,
      masterSliders: data.masterSliders
    });
    
    log('Fixtures data saved successfully', 'INFO', { 
      fixtures: data.fixtures?.length || 0,
      groups: data.groups?.length || 0
    });
    return true;
  } catch (error) {
    log('Error saving fixtures data', 'ERROR', { error });
    return false;
  }
};

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

// Check for factory reset marker
apiRouter.get('/factory-reset-check', (req, res) => {
  try {
    const markerPath = path.join(DATA_DIR, '.factory-reset-marker.json');
    if (fs.existsSync(markerPath)) {
      const markerData = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
      // Delete the marker after reading (one-time use)
      fs.unlinkSync(markerPath);
      res.json({ factoryReset: true, timestamp: markerData.timestamp });
    } else {
      res.json({ factoryReset: false });
    }
  } catch (error) {
    log('Error checking factory reset marker', 'ERROR', { error });
    res.json({ factoryReset: false });
  }
});

// Get initial state
apiRouter.get('/state', (req, res) => {
  try {
    // Load configuration and scenes
    const config = loadConfig(); // loadConfig now also returns oscAssignments

    const scenesData = fs.readFileSync(path.join(DATA_DIR, 'scenes.json'), 'utf-8');
    const scenes = JSON.parse(scenesData);

    // Read fixtures data from file
    const fixturesData = loadFixturesData();

    // Return all state, using actual values from server where available
    res.json({
      artNetConfig: config.artNetConfig,
      oscConfig: config.oscConfig, // Include OSC configuration
      midiMappings: config.midiMappings,
      scenes,
      dmxChannels: getDmxChannels(), // Use getter for actual DMX channel state
      oscAssignments: config.oscAssignments, // Use loaded OSC assignments
      channelNames: getChannelNames(), // Use getter for actual channel names
      channelRanges: getChannelRanges(), // Use getter for channel ranges
      fixtures: fixturesData.fixtures,
      groups: fixturesData.groups,
      fixtureLayout: fixturesData.fixtureLayout,
      masterSliders: fixturesData.masterSliders,
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

    setDmxChannel(channel, value);
    res.json({ success: true });
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

    const updateEntries = Object.entries(updates);
    const updateCount = updateEntries.length;

    // Check if this is a "set all to zero" operation (all values are 0 and many channels)
    const allZero = updateEntries.every(([_, value]) => value === 0);
    const isLargeBatch = updateCount > 50;

    // For large batches or all-zero operations, use optimized setDmxChannels
    if ((allZero && updateCount > 10) || (isLargeBatch && updateCount > 100)) {
      // Build array of all 512 channels, using updates where provided, otherwise keep current
      const currentChannels = getDmxChannels();
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
      setDmxChannels(newChannels);

      if (errors.length > 0) {
        log('Batch DMX update completed with errors (optimized path)', 'WARN', { updateCount, errors });
        res.status(207).json({ success: true, updateCount, errors }); // 207 Multi-Status
      } else {
        log('Batch DMX update completed successfully (optimized path)', 'INFO', { updateCount });
        res.json({ success: true, updateCount });
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

      setDmxChannel(channel, value);
      successCount++;
    }

    if (errors.length > 0) {
      log('Batch DMX update completed with errors', 'WARN', { updateCount: successCount, errors });
      res.status(207).json({ success: true, updateCount: successCount, errors }); // 207 Multi-Status
    } else {
      log('Batch DMX update completed successfully', 'INFO', { updateCount: successCount });
      res.json({ success: true, updateCount: successCount });
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
apiRouter.post('/scenes', (req, res) => {
  try {
    const { name, oscAddress, channelValues } = req.body;

    saveScene(global.io, name, oscAddress, channelValues);

    res.json({ success: true });
  } catch (error) {
    log('Error saving scene', 'ERROR', { error, body: req.body });
    res.status(500).json({ error: `Failed to save scene: ${error}` });
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

    log('All scenes cleared via factory reset', 'INFO');
    res.json({ success: true, message: 'All scenes cleared' });
  } catch (error) {
    log('Error clearing all scenes', 'ERROR', { error });
    res.status(500).json({ error: `Failed to clear all scenes: ${error}` });
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

// Fixtures endpoints
// POST /api/fixtures - Save all fixtures (for bulk operations, still supported)
apiRouter.post('/fixtures', (req, res) => {
  try {
    const { fixtures } = req.body;
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

    // Get list of current fixture IDs
    const currentIds = new Set(currentData.fixtures.map((f: any) => f.id));
    const newIds = new Set(fixtures.map((f: any) => f.id));

    // Delete fixtures that are no longer in the list
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        deleteFixtureFile(id);
      }
    }

    // Save each fixture to its own file
    ensureFixturesDir();
    for (const fixture of fixtures) {
      if (fixture && fixture.id) {
        saveFixtureFile(fixture);
      }
    }

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

    // Load current fixture data (groups, layout, masterSliders)
    const fixtureData = loadFixtureData();
    fixtureData.groups = groups;

    // Save updated fixture data
    const success = saveFixtureData(fixtureData);

    if (success) {
      // Notify all clients of the groups update
      global.io.emit('groupsUpdate', groups);
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

// Socket.IO handler setup
function setupSocketHandlers(io: Server) {
  // Store the io instance globally for use in API routes
  global.io = io;

  // Load fixtures on startup to ensure they're available
  try {
    loadFixtures();
    log('Fixtures loaded on server startup', 'INFO', { fixtures: loadFixturesData().fixtures.length });
  } catch (error) {
    log('Error loading fixtures on startup', 'ERROR', { error });
  }

  io.on('connection', (socket) => {
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

    // Handle TouchOSC Layout Auto-Upload (UDP push to Editor or collection server)
    socket.on('uploadTouchOscLayout', async (data: { ip: string, xml: string, resolution: string, port?: number }) => {
      const { ip, xml, port = 6666 } = data;
      log('Preparing TouchOSC layout upload', 'TOUCHOSC', { targetIp: ip, targetPort: port });

      try {
        const JSZip = require('jszip');
        const zip = new JSZip();
        zip.file("index.xml", xml);
        const content = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 9 }
        });

        // Cache it for HTTP download
        lastTouchOscLayout = content;
        lastTouchOscXml = xml;

        // If IP is provided and not empty, try pushing via UDP
        // Also support port 6666 as a "collection" port
        if (ip && ip !== '192.168.1.' && ip !== '0.0.0.0' && ip.split('.').length === 4) {
          const client = dgram.createSocket('udp4');
          client.send(content, 0, content.length, port, ip, (err) => {
            client.close();
            if (err) {
              log('TouchOSC upload failed (UDP error)', 'ERROR', { error: err.message, ip, port });
              socket.emit('uploadStatus', { success: false, message: `UDP Error: ${err.message}` });
            } else {
              log('TouchOSC layout pushed successfully', 'TOUCHOSC', { ip, port, size: content.length });
              socket.emit('uploadStatus', { success: true, message: `Layout pushed to ${ip}:${port}` });
            }
          });
        }

        // Always ensure the file is ready for collection on port 6666 (HTTP) if we can
        // We can't easily start multiple port listeners in this single route without complexity,
        // but we already provide layout.tosc on the main port.
        // The user suggested port 6666 for collection.
        log('TouchOSC layout cached and ready for collection/download', 'TOUCHOSC');
        if (!ip || ip === '192.168.1.') {
          socket.emit('uploadStatus', { success: true, message: `Layout ready for download or collection.` });
        }
      } catch (error) {
        log('TouchOSC layout processing failed', 'ERROR', { error: error instanceof Error ? error.message : String(error) });
        socket.emit('uploadStatus', {
          success: false,
          message: `Processing Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    // Provide the last layout XML to clients
    socket.on('getTouchOscXml', () => {
      socket.emit('touchOscXml', lastTouchOscXml);
    });
  });
}

// Import sendOscMessage from index.ts
import { sendOscMessage } from './index';

// Add missing API endpoints for state import/export
apiRouter.post('/api/state', (req, res) => {
  try {
    const stateData = req.body;

    if (!stateData || !stateData.dmxChannels) {
      return res.status(400).json({
        error: 'Invalid state data - dmxChannels required',
        success: false
      });
    }

    // Import setDmxChannels function
    const { setDmxChannels } = require('./core');

    if (typeof setDmxChannels === 'function') {
      setDmxChannels(stateData.dmxChannels);

      // Save the state to last-state.json
      const statePath = path.join(DATA_DIR, 'last-state.json');
      const stateToSave = {
        timestamp: new Date().toISOString(),
        dmxChannels: stateData.dmxChannels,
        savedOn: 'imported-state'
      };

      fs.writeFileSync(statePath, JSON.stringify(stateToSave, null, 2));

      log('State imported and saved successfully', 'SYSTEM', {
        channelsImported: stateData.dmxChannels.filter((val: number) => val > 0).length
      });

      // Notify all clients about the imported state
      const io = global.io;
      if (io) {
        io.emit('dmxStateRestored', { dmxChannels: stateData.dmxChannels });
      }

      res.json({
        success: true,
        message: 'State imported successfully',
        channelsImported: stateData.dmxChannels.filter((val: number) => val > 0).length
      });
    } else {
      res.status(500).json({
        error: 'setDmxChannels function not available',
        success: false
      });
    }
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

apiRouter.post('/api/scenes', (req, res) => {
  try {
    const scenesData = req.body;

    if (!Array.isArray(scenesData)) {
      return res.status(400).json({
        error: 'Invalid scenes data - array expected',
        success: false
      });
    }

    // Save scenes to file
    const scenesPath = path.join(DATA_DIR, 'scenes.json');
    fs.writeFileSync(scenesPath, JSON.stringify(scenesData, null, 2));

    // Reload scenes in memory
    const { loadScenes } = require('./core');
    if (typeof loadScenes === 'function') {
      loadScenes();
    }

    log('Scenes imported successfully', 'SYSTEM', {
      scenesCount: scenesData.length
    });

    res.json({
      success: true,
      message: 'Scenes imported successfully',
      scenesCount: scenesData.length
    });
  } catch (error) {
    log('Error importing scenes', 'ERROR', {
      message: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      error: `Failed to import scenes: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.post('/api/config', (req, res) => {
  try {
    const configData = req.body;

    if (!configData || typeof configData !== 'object') {
      return res.status(400).json({
        error: 'Invalid config data - object expected',
        success: false
      });
    }

    // Save config to file
    const configPath = path.join(DATA_DIR, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

    // Reload config in memory
    const { loadConfig } = require('./core');
    if (typeof loadConfig === 'function') {
      loadConfig();
    }

    log('Config imported successfully', 'SYSTEM');

    res.json({
      success: true,
      message: 'Config imported successfully'
    });
  } catch (error) {
    log('Error importing config', 'ERROR', {
      message: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      error: `Failed to import config: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

// Face Tracker Configuration endpoints
const FACE_TRACKER_CONFIG_PATH = path.join(__dirname, '..', 'face-tracker', 'face-tracker-config.json');
const faceTrackerService = new FaceTrackerService();

apiRouter.get('/face-tracker/config', (req, res) => {
  try {
    if (!fs.existsSync(FACE_TRACKER_CONFIG_PATH)) {
      // Return default config if file doesn't exist
      const defaultConfig = {
        dmxApiUrl: "http://localhost:3030/api/dmx/batch",
        panChannel: 1,
        tiltChannel: 2,
        irisChannel: 0,
        zoomChannel: 0,
        focusChannel: 0,
        cameraIndex: 0,
        updateRate: 30,
        panSensitivity: 1.0,
        tiltSensitivity: 1.0,
        panOffset: 128,
        tiltOffset: 128,
        irisValue: 128,
        zoomValue: 128,
        focusValue: 128,
        showPreview: true,
        show3DVisualization: true,
        smoothingFactor: 0.85,
        maxVelocity: 50.0,
        brightness: 1.0,
        contrast: 1.0,
        cameraExposure: -1,
        cameraBrightness: -1,
        autoExposure: true,
        useOSC: false,
        oscHost: "127.0.0.1",
        oscPort: 9000,
        oscPanPath: "/pan",
        oscTiltPath: "/tilt",
        oscIrisPath: "/iris",
        oscZoomPath: "/zoom",
        oscFocusPath: "/focus",
        panMin: 0,
        panMax: 255,
        tiltMin: 0,
        tiltMax: 255,
        irisMin: 0,
        irisMax: 255,
        zoomMin: 0,
        zoomMax: 255,
        focusMin: 0,
        focusMax: 255,
        panScale: 1.0,
        tiltScale: 1.0,
        panDeadZone: 0.0,
        tiltDeadZone: 0.0,
        panLimit: 1.0,
        tiltLimit: 1.0,
        panGear: 1.0,
        tiltGear: 1.0
      };
      res.json(defaultConfig);
      return;
    }

    const configData = fs.readFileSync(FACE_TRACKER_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    res.json(config);
  } catch (error) {
    log('Error reading face tracker config', 'ERROR', { error });
    res.status(500).json({
      error: `Failed to read face tracker config: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.put('/face-tracker/config', (req, res) => {
  try {
    const configData = req.body;

    if (!configData || typeof configData !== 'object') {
      return res.status(400).json({
        error: 'Invalid config data - object expected',
        success: false
      });
    }

    // Ensure directory exists
    const configDir = path.dirname(FACE_TRACKER_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Save config to file
    fs.writeFileSync(FACE_TRACKER_CONFIG_PATH, JSON.stringify(configData, null, 2));

    log('Face tracker config saved successfully', 'SYSTEM');

    res.json({
      success: true,
      message: 'Face tracker config saved successfully'
    });
  } catch (error) {
    log('Error saving face tracker config', 'ERROR', {
      message: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      error: `Failed to save face tracker config: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

// Face Tracker Service endpoints
apiRouter.post('/face-tracker/start', async (req, res) => {
  try {
    const config = req.body || {};
    await faceTrackerService.start(config);
    res.json({ success: true, message: 'Face tracker started' });
  } catch (error) {
    log('Error starting face tracker', 'ERROR', { error });
    res.status(500).json({
      error: `Failed to start face tracker: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.post('/face-tracker/stop', (req, res) => {
  try {
    faceTrackerService.stop();
    res.json({ success: true, message: 'Face tracker stopped' });
  } catch (error) {
    log('Error stopping face tracker', 'ERROR', { error });
    res.status(500).json({
      error: `Failed to stop face tracker: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

apiRouter.get('/face-tracker/status', (req, res) => {
  try {
    const status = faceTrackerService.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    log('Error getting face tracker status', 'ERROR', { error });
    res.status(500).json({
      error: `Failed to get face tracker status: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    });
  }
});

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

export { apiRouter, setupSocketHandlers };