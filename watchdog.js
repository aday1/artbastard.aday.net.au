/**
 * Watchdog script for ArtBastard_DMX512FTW
 * 
 * This script monitors the application and restarts it if it crashes.
 */
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CHECK_INTERVAL = 10000; // Check every 10 seconds
const RESTART_DELAY = 3000;   // Wait 3 seconds before restart
const MAX_RESTARTS = 5;       // Maximum restarts in a given period
const RESTART_PERIOD = 300000; // 5 minutes period for restart count

// State tracking
let mainProcess = null;
let restartCount = 0;
let lastRestartTimestamp = Date.now();
let isRestarting = false;

// Log to file and console
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - WATCHDOG: ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(path.join(__dirname, 'logs', 'watchdog.log'), logMessage + '\n');
  } catch (err) {
    // If the logs directory doesn't exist, create it
    if (!fs.existsSync(path.join(__dirname, 'logs'))) {
      fs.mkdirSync(path.join(__dirname, 'logs'));
      fs.appendFileSync(path.join(__dirname, 'logs', 'watchdog.log'), logMessage + '\n');
    }
  }
}

// Kill any hanging processes
function killHangingProcesses() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('tasklist /fi "imagename eq node.exe" /fo csv | findstr /i "artbastard"', (err, stdout) => {
        if (stdout && stdout.length > 0) {
          exec('taskkill /f /im node.exe /fi "windowtitle eq *artbastard*"', () => {
            log('Killed hanging Node.js processes');
            setTimeout(resolve, 1000);
          });
        } else {
          resolve();
        }
      });
    } else {
      // Unix-like systems (Linux, macOS)
      exec('pgrep -f "node.*artbastard"', (err, stdout) => {
        if (stdout && stdout.length > 0) {
          const pids = stdout.trim().split('\n');
          pids.forEach(pid => {
            exec(`kill -9 ${pid}`, () => {
              log(`Killed process with PID ${pid}`);
            });
          });
          setTimeout(resolve, 1000);
        } else {
          resolve();
        }
      });
    }
  });
}

// Start the application
async function startApp() {
  await killHangingProcesses();
  
  log('Starting application...');
  
  if (process.platform === 'win32') {
    mainProcess = spawn('node', ['start-server.js'], {
      detached: true,
      stdio: 'pipe',
      windowsHide: false,
      env: { ...process.env, NODE_ENV: 'production' }
    });
  } else {
    // Unix-like systems
    mainProcess = spawn('node', ['start-server.js'], {
      detached: true,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' }
    });
  }
  
  mainProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log(`App output: ${output}`);
  });
  
  mainProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) log(`App error: ${output}`);
  });
  
  mainProcess.on('close', (code) => {
    log(`Application process exited with code ${code}`);
    
    if (!isRestarting) {
      handleCrash();
    }
  });
  
  // Check if process is still running after a brief delay
  setTimeout(() => {
    if (mainProcess && !mainProcess.killed) {
      log('Application started successfully');
    }
  }, 3000);
}

// Handle application crash
function handleCrash() {
  const now = Date.now();
  
  // Reset restart count if outside the restart period
  if (now - lastRestartTimestamp > RESTART_PERIOD) {
    restartCount = 0;
  }
  
  restartCount++;
  lastRestartTimestamp = now;
  
  if (restartCount <= MAX_RESTARTS) {
    log(`Application crashed. Restarting... (Attempt ${restartCount}/${MAX_RESTARTS})`);
    isRestarting = true;
    
    setTimeout(() => {
      startApp().then(() => {
        isRestarting = false;
      });
    }, RESTART_DELAY);
  } else {
    log(`Too many restarts (${MAX_RESTARTS}) in the last ${RESTART_PERIOD / 60000} minutes. Stopping watchdog.`);
    process.exit(1);
  }
}

// Check if application is still responsive
function checkApplicationHealth() {
  if (mainProcess && mainProcess.killed) {
    log('Process was killed externally, restarting...');
    handleCrash();
    return;
  }
  
  // On Windows, check if the application port is still responding
  if (process.platform === 'win32') {
    exec('netstat -ano | findstr "3001"', (err, stdout) => {
      if (err || !stdout) {
        log('Application port not responding, restarting...');
        if (mainProcess) {
          try {
            process.kill(mainProcess.pid);
          } catch (e) {
            // Process might already be dead
          }
        }
        handleCrash();
      }
    });
  }
}

// Start the watchdog
(async function main() {
  log('Starting watchdog service');
  await startApp();
  
  // Periodically check application health
  setInterval(checkApplicationHealth, CHECK_INTERVAL);
  
  // Handle watchdog process termination
  process.on('SIGINT', async () => {
    log('Watchdog shutting down...');
    if (mainProcess) {
      try {
        process.kill(mainProcess.pid);
      } catch (e) {
        // Process might already be dead
      }
    }
    await killHangingProcesses();
    process.exit(0);
  });
})();
