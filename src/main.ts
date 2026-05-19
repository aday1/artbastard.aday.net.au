// Main entry point for the ArtBastard DMX512FTW application
import { log } from './logger';

log('🚀 Starting ArtBastard DMX512FTW server from main entry point...', 'SYSTEM');

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
