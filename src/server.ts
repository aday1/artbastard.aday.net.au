import express from 'express';
import http, { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { json } from 'body-parser';
import { log } from './logger'; // Import from logger instead of index
import { startLaserTime, listMidiInterfaces, connectMidiInput, disconnectMidiInput, updateArtNetConfig, pingArtNetDevice } from './core';
import { apiRouter, setupSocketHandlers } from './api';
import { clockManager, MasterClockSourceId, ClockState } from './clockManager';

// Declare global io instance for use in API routes
declare global {
  var io: Server;
}

// Ensure required directories exist
function ensureDirectoriesExist() {
  const directories = [
    path.join(__dirname, '..', 'data'),
    path.join(__dirname, '..', 'logs')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        log(`Created directory: ${dir}`, 'SYSTEM');
      } catch (error) {
        log(`Failed to create directory ${dir}`, 'ERROR', { error });
      }
    }
  });
}

// Create express app with improved error handling
const app = express();
const server = createServer(app);

// Configure CORS for all routes with more permissive settings
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(json());

// Ensure all required directories exist before proceeding
ensureDirectoriesExist();

// Configure Socket.IO with improved error handling and connection management
try {
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,    connectTimeout: 45000,
    maxHttpBufferSize: 1e8, // 100MB
    path: '/socket.io',
    
    // Add more robust connection handling
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    }
  });

  // Make io available globally for use in other modules
  global.io = io;

  // ClockManager integration: Subscribe to updates and broadcast via WebSocket
  clockManager.subscribe((clockState: ClockState) => {
    log('Broadcasting clock update:', 'CLOCK', clockState);
    if (global.io) {
      global.io.emit('masterClockUpdate', clockState);
    }
  });

  // Add specific middleware for rate limiting and validation
  io.use((socket, next) => {
    // Track message rate
    const messageCount = { count: 0, lastReset: Date.now() };
    const rateLimitWindow = 1000; // 1 second
    const maxMessagesPerWindow = 100;

    socket.on('message', () => {
      const now = Date.now();
      
      if (now - messageCount.lastReset > rateLimitWindow) {
        messageCount.count = 0;
        messageCount.lastReset = now;
      }
      messageCount.count++;
      
      if (messageCount.count > maxMessagesPerWindow) {
        socket.emit('error', 'Rate limit exceeded');
        return;
      }
    });

    // Validate connection
    if (socket.handshake.auth && socket.handshake.auth.token) {
      // Add your token validation logic here if needed
      next();
    } else {
      next();
    }
  });

  // Add global error handlers
  io.engine.on("connection_error", (err) => {
    log('Socket.IO connection error', 'ERROR', { code: err.code, message: err.message, context: err.context });
  });

  process.on('uncaughtException', (err) => {
    log('Uncaught Exception', 'ERROR', { message: err.message, stack: err.stack });
  });

  process.on('unhandledRejection', (reason) => {
    log('Unhandled Rejection', 'ERROR', { reason });
  });

  // Function to restore last saved state on startup
  function restoreLastState(io: Server) {
    try {
      const statePath = path.join(__dirname, '..', 'data', 'last-state.json');
      
      if (fs.existsSync(statePath)) {
        const stateData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        
        log('Found previous state - restoring...', 'SYSTEM', { 
          savedOn: stateData.savedOn,
          timestamp: stateData.timestamp 
        });
        
        // Create backup of current state before restoring
        const backupPath = path.join(__dirname, '..', 'data', `last-state-backup-${Date.now()}.json`);
        try {
          fs.copyFileSync(statePath, backupPath);
          log('Created backup of previous state', 'SYSTEM', { backupPath });
        } catch (backupError) {
          log('Failed to create backup', 'WARN', { error: backupError instanceof Error ? backupError.message : String(backupError) });
        }
        
        // Restore DMX channels if available
        if (stateData.dmxChannels && Array.isArray(stateData.dmxChannels) && stateData.dmxChannels.length === 512) {
          // Import the setDmxChannels function to restore state
          const { setDmxChannels } = require('./core');
          
          // Restore the DMX state
          if (typeof setDmxChannels === 'function') {
            setDmxChannels(stateData.dmxChannels);
            log('DMX state restored successfully', 'SYSTEM', { 
              channelsRestored: stateData.dmxChannels.filter((val: number) => val > 0).length 
            });
            
            // Notify all clients about the restored state
            // Send the restored DMX state to all connected clients
            io.emit('dmxStateRestored', { dmxChannels: stateData.dmxChannels });
          } else {
            log('setDmxChannels function not available for restoration', 'ERROR');
          }
        } else {
          log('No valid DMX channels found in state file', 'WARN');
        }
        
        log('State restoration completed', 'SYSTEM');
      } else {
        log('No previous state found - starting fresh', 'SYSTEM');
      }
    } catch (error) {
      log('Error restoring last state', 'ERROR', { 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      });
    }
  }

  // Graceful shutdown handler - Save all states when Ctrl+C is pressed
  function gracefulShutdown(signal: string) {
    log(`Graceful shutdown initiated (${signal})`, 'SYSTEM');
    
    try {
      // Import save functions from core
      const { saveConfig, saveScenes, saveActs, saveFixtures, saveGroups, getDmxChannels } = require('./core');
      
      // Get current state counts before saving
      const currentDmxState = getDmxChannels();
      const activeDmxChannels = currentDmxState ? currentDmxState.filter((v: number) => v > 0).length : 0;
      
      // Load current state to get counts - use bundle format loader
      // Try to load from API module first (bundle format), fallback to core
      let currentFixtures: any[] = [];
      let currentGroups: any[] = [];
      
      try {
        // Try using the API module's loadFixturesData which uses bundle format
        const apiModule = require('./api');
        if (apiModule.loadFixturesData) {
          const fixturesData = apiModule.loadFixturesData();
          currentFixtures = fixturesData.fixtures || [];
          currentGroups = fixturesData.groups || [];
        } else {
          throw new Error('loadFixturesData not found in api module');
        }
      } catch (err) {
        // Fallback to core module
        const core = require('./core');
        currentFixtures = core.loadFixtures() || [];
        currentGroups = core.loadGroups() || [];
      }
      
      // Load other state
      const core = require('./core');
      const currentScenes = core.loadScenes();
      const currentActs = core.loadActs();
      const currentConfig = core.loadConfig();
      const midiMappingCount = Object.keys(currentConfig.midiMappings || {}).length;
      const oscAssignmentCount = currentConfig.oscAssignments ? currentConfig.oscAssignments.filter((a: string) => a && a.trim() !== '').length : 0;
      
      // Save current configuration (MIDI mappings, OSC assignments, etc.)
      saveConfig();
      
      // Save current scenes
      saveScenes();
      
      // Save current acts
      saveActs();
      
      // Save current fixtures and groups
      saveFixtures();
      saveGroups();
      
      // Save current DMX state to a state file
      if (currentDmxState && currentDmxState.length > 0) {
        const statePath = path.join(__dirname, '..', 'data', 'last-state.json');
        const stateData = {
          timestamp: new Date().toISOString(),
          dmxChannels: currentDmxState,
          savedOn: 'graceful-shutdown'
        };
        fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2));
      }
      
      // Show summary of what was saved
      log('States saved', 'SYSTEM', {
        fixtures: currentFixtures.length,
        groups: currentGroups.length,
        scenes: currentScenes.length,
        acts: currentActs.length,
        dmxActive: activeDmxChannels,
        midiMappings: midiMappingCount,
        oscAssignments: oscAssignmentCount
      });
      
      log('Shutting down...', 'SYSTEM', { quiet: true });
      
      // Close server gracefully
      server.close(() => {
        log('Server closed', 'SYSTEM', { quiet: true });
        process.exit(0);
      });
      
      // Force exit after 5 seconds if graceful shutdown hangs
      setTimeout(() => {
        log('Force shutdown after timeout', 'SYSTEM', { quiet: true });
        process.exit(1);
      }, 5000);
      
    } catch (error) {
      log('Error during graceful shutdown', 'ERROR', { 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      });
      process.exit(1);
    }
  }

  // Register shutdown handlers for different signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  // Handle Windows-specific shutdown signals
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK (Ctrl+Break)'));
  }

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    log('A user connected', 'SERVER', { socketId: socket.id, transport: socket.conn.transport.name });

    // Send initial clock state and available sources
    socket.emit('masterClockUpdate', clockManager.getState());
    socket.emit('availableClockSources', clockManager.getAvailableSources());

    // Send available MIDI interfaces to the client
    const midiInterfaces = listMidiInterfaces();
    log('MIDI interfaces found', 'MIDI', { inputs: midiInterfaces.inputs, isWsl: midiInterfaces.isWsl });
    socket.emit('midiInterfaces', midiInterfaces.inputs);

    // Handle MIDI interface selection
    socket.on('selectMidiInterface', (interfaceName) => {
      log('Selecting MIDI interface', 'MIDI', { interfaceName, socketId: socket.id });
      connectMidiInput(io, interfaceName);
    });

    // Handle MIDI interface disconnection
    socket.on('disconnectMidiInterface', (interfaceName) => {
      log('Disconnecting MIDI interface', 'MIDI', { interfaceName, socketId: socket.id });
      disconnectMidiInput(io, interfaceName);
    });

    // Handle request for refreshing MIDI interfaces
    socket.on('getMidiInterfaces', () => {
      const midiInterfaces = listMidiInterfaces();
      socket.emit('midiInterfaces', midiInterfaces.inputs);
    });

    socket.on('updateArtNetConfig', (config) => {
      try {
        updateArtNetConfig(config);
        socket.emit('artnetStatus', { status: 'configUpdated' });
        // Test connection with new config
        pingArtNetDevice(io, config.ip);
      } catch (error) {
        socket.emit('artnetStatus', { 
          status: 'error',
          message: `Config update failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    socket.on('testArtNetConnection', (ip) => {
      try {
        pingArtNetDevice(io, ip);
      } catch (error) {
        socket.emit('artnetStatus', {
          status: 'error',
          message: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    // ClockManager control handlers
    socket.on('setMasterClockSource', (sourceId: MasterClockSourceId) => {
      log(`Client ${socket.id} setMasterClockSource: ${sourceId}`, 'CLOCK');
      // Basic validation for sourceId can be added here if MasterClockSourceId type isn't strictly enforced by Socket.IO
      if (clockManager.getAvailableSources().find(s => s.id === sourceId)) {
        clockManager.setSource(sourceId);
      } else {
        log(`Invalid clock sourceId from ${socket.id}: ${sourceId}`, 'WARN');
        // socket.emit('error', 'Invalid clock source ID'); // Optional
      }
    });

    socket.on('setInternalClockBPM', (bpm: number) => {
      log(`Client ${socket.id} setInternalClockBPM: ${bpm}`, 'CLOCK');
      if (typeof bpm === 'number' && bpm > 0 && bpm <= 400) { // Basic validation
         clockManager.setBPM(bpm);
      } else {
         log(`Invalid BPM value from ${socket.id}: ${bpm}`, 'WARN');
         // socket.emit('error', 'Invalid BPM value'); // Optional feedback
      }
    });    socket.on('toggleMasterClockPlayPause', () => {
      log(`Client ${socket.id} toggleMasterClockPlayPause`, 'CLOCK');
      console.log('Server: Received toggleMasterClockPlayPause socket event, calling clockManager.togglePlayPause()');
      clockManager.togglePlayPause();
    });
    
    socket.on('getMidiClockOutputs', async () => {
      log(`Client ${socket.id} requesting MIDI clock outputs`, 'CLOCK');
      const outputs = await clockManager.refreshMidiOutputs();
      const currentOutput = clockManager.getCurrentMidiOutput();
      socket.emit('midiClockOutputs', { outputs, currentOutput });
    });
    
    socket.on('setMidiClockOutput', async (outputName: string) => {
      log(`Client ${socket.id} setMidiClockOutput: ${outputName}`, 'CLOCK');
      const success = await clockManager.setMidiOutput(outputName);
      
      if (success) {
        // Broadcast the change to all clients
        io.emit('midiClockOutputChanged', { outputName });
        socket.emit('notification', { 
          message: `MIDI Clock output set to ${outputName}`,
          type: 'success'
        });
      } else {
        socket.emit('notification', { 
          message: `Failed to set MIDI Clock output to ${outputName}`,
          type: 'error'
        });
      }
    });

    // MIDI Clock Input (External clock) handlers
    socket.on('getMidiClockInputs', async () => {
      log(`Client ${socket.id} requesting MIDI clock inputs`, 'CLOCK');
      if (clockManager.refreshMidiInputs) {
        const inputs = await clockManager.refreshMidiInputs();
        const currentInput = clockManager.getCurrentMidiInput?.();
        socket.emit('midiClockInputs', { inputs, currentInput });
      } else {
        socket.emit('midiClockInputs', { inputs: [], currentInput: null });
      }
    });

    socket.on('setMidiClockInput', async (inputName: string) => {
      log(`Client ${socket.id} setMidiClockInput: ${inputName}`, 'CLOCK');
      if (!clockManager.setMidiInput) {
        socket.emit('notification', {
          message: 'MIDI input selection not supported on server build',
          type: 'error'
        });
        return;
      }
      const success = await clockManager.setMidiInput(inputName);
      if (success) {
        io.emit('midiClockInputChanged', { inputName });
        socket.emit('notification', {
          message: `MIDI Clock input set to ${inputName}`,
          type: 'success'
        });
        // If user selects an input, automatically switch clock source to midi-input
        clockManager.setSource('midi-input');
        socket.emit('masterClockUpdate', clockManager.getState());
      } else {
        socket.emit('notification', {
          message: `Failed to set MIDI Clock input to ${inputName}`,
          type: 'error'
        });
      }
    });

    socket.on('setMasterClockBeat', (beat: number) => {
      log(`Client ${socket.id} setMasterClockBeat: ${beat}`, 'CLOCK');
      if (typeof beat === 'number') {
        clockManager.setBeat(beat);
      } else {
        log(`Invalid beat value from ${socket.id}: ${beat}`, 'WARN');
      }
    });

    socket.on('setMasterClockBar', (bar: number) => {
      log(`Client ${socket.id} setMasterClockBar: ${bar}`, 'CLOCK');
      if (typeof bar === 'number') {
        clockManager.setBar(bar);
      } else {
        log(`Invalid bar value from ${socket.id}: ${bar}`, 'WARN');
      }
    });

    socket.on('disconnect', (reason) => {
      log('User disconnected', 'SERVER', { reason, socketId: socket.id });
    });

    // Handle reconnection attempts
    socket.on('reconnect_attempt', (attemptNumber) => {
      log('Reconnection attempt', 'SERVER', { attemptNumber, socketId: socket.id });
    });

    socket.on('reconnect', (attemptNumber) => {
      log('Client reconnected', 'SERVER', { attemptNumber, socketId: socket.id });
    });

    socket.on('reconnect_error', (error) => {
      log('Reconnection error', 'ERROR', { error, socketId: socket.id });
    });

    socket.on('reconnect_failed', () => {
      log('Client failed to reconnect after all attempts', 'WARN', { socketId: socket.id });
    });
  });

  // Set up API routes
  app.use('/api', apiRouter);

  // Serve static files from the React app with no caching
  app.use(express.static(path.join(__dirname, '..', 'react-app', 'dist'), {
    setHeaders: (res, path) => {
      // Disable caching for all static files
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));

  // For any routes not handled by specific endpoints, serve the React app
  app.get('*', (req, res) => {
    const reactAppPath = path.join(__dirname, '..', 'react-app', 'dist', 'index.html');
    
    // Check if the React app is built
    if (fs.existsSync(reactAppPath)) {
      res.sendFile(reactAppPath);
    } else {
      // If React app is not built, trigger a build first
      log('React app not built. Building React app now...', 'SYSTEM');
      
      try {
        // Execute the build in a synchronous way
        const buildResult = require('child_process').execSync(
          'cd react-app && npm run build',
          { stdio: 'inherit' }
        );
        
        // After successful build, serve the React app
        if (fs.existsSync(reactAppPath)) {
          log('React app built successfully. Serving React app.', 'SYSTEM');
          res.sendFile(reactAppPath);
        } else {
          // Still not found, send an error
          log('React app still not found after build attempt.', 'ERROR');
          res.status(500).send(`
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h1>React App Build Error</h1>
                <p>Failed to build or find the React application.</p>
                <p>Please run: <code>cd react-app && npm run build</code> manually.</p>
              </body>
            </html>
          `);
        }
      } catch (error) {
        // Build failed, send an error
        log('Error building React app', 'ERROR', { error });
        res.status(500).send(`
          <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1>React App Build Error</h1>
              <p>Failed to build React application: ${error}</p>
              <p>Please check the console logs for more information.</p>
            </body>
          </html>
        `);
      }
    }
  });

  // Set up additional Socket.IO handlers from API
  setupSocketHandlers(io);
  // Start the server with automatic port fallback
  const basePortEnv = process.env.PORT;
  const basePort = basePortEnv ? parseInt(basePortEnv, 10) : 3030;
  let currentPort = Number.isFinite(basePort) ? basePort : 3030;
  const maxPortAttempts = 10;

  function startListening() {
    server.listen(currentPort, '0.0.0.0', () => {
      log(`Server running at http://0.0.0.0:${currentPort}`, 'SERVER');
      log(`Server accessible on local network at http://[YOUR_IP]:${currentPort}`, 'SERVER');
      log(`React app available at http://0.0.0.0:${currentPort}`, 'SERVER');
    
    // Get and log the actual network IP for convenience
    const networkInterfaces = require('os').networkInterfaces();
    const networkIPs = [];
    
    Object.keys(networkInterfaces).forEach(key => {
      networkInterfaces[key].forEach(details => {
        if (details.family === 'IPv4' && !details.internal) {
          networkIPs.push(details.address);
        }
      });
    });
    
    if (networkIPs.length > 0) {
      networkIPs.forEach(ip => {
        log(`Network access: http://${ip}:${currentPort}`, 'SERVER');
      });
    }
    
    // Initialize application with Socket.IO instance
    try {
      startLaserTime(io);
      
      // Restore last saved state if available
      restoreLastState(io);
      
    } catch (error) {
      log('ERROR initializing application', 'ERROR', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    }
    });
  }

  // Error handler for server with fallback ports
  server.on('error', (error) => {
    if ((error as any).code === 'EADDRINUSE') {
      if (currentPort - basePort < maxPortAttempts) {
        log(`Port ${currentPort} is in use. Trying ${currentPort + 1}...`, 'WARN');
        currentPort += 1;
        setTimeout(() => startListening(), 100);
      } else {
        log(`All attempted ports starting at ${basePort} are in use. Giving up.`, 'ERROR');
      }
    } else {
      log('SERVER ERROR', 'ERROR', { message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Kick off listening
  startListening();

} catch (error) {
  log('FATAL ERROR initializing Socket.IO', 'ERROR', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
}