// This is the main entry point for the ArtBastard DMX512FTW server application
// It provides a clear startup path for the application

import { log } from './logger';

// Log server startup
log('🚀 Starting ArtBastard DMX512FTW server...', 'SYSTEM');

try {
  // Import the server module which starts the Express and Socket.IO server
  require('./server');
  
  // Log successful startup
  log('✅ Server modules loaded successfully', 'SYSTEM');
} catch (error) {
  // Log any startup errors
  log('❌ ERROR during server startup', 'ERROR', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
  process.exit(1);
}