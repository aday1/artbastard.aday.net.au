import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';

// Constants for logging
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'app.log');

let isLoggingEnabled = true;
let isConsoleLoggingEnabled = true;

// Define log types and their colors/styles
const logTypes = {
  INFO: { color: chalk.blue, label: 'INFO', colorString: 'blue' },
  ERROR: { color: chalk.red.bold, label: 'ERROR', colorString: 'red' },
  WARN: { color: chalk.yellow, label: 'WARN', colorString: 'yellow' },
  MIDI: { color: chalk.hex('#FFA500'), label: 'MIDI', colorString: 'orange' }, // Orange
  OSC: { color: chalk.green, label: 'OSC', colorString: 'green' },
  ARTNET: { color: chalk.cyan, label: 'ARTNET', colorString: 'cyan' },
  SERVER: { color: chalk.magenta, label: 'SERVER', colorString: 'magenta' },
  DMX: { color: chalk.gray, label: 'DMX', colorString: 'gray' },
  SYSTEM: { color: chalk.white.bold, label: 'SYSTEM', colorString: 'white' },
  CLOCK: { color: chalk.hex('#FF69B4'), label: 'CLOCK', colorString: 'hotpink' }, // Hot Pink
  FACE_TRACKER: { color: chalk.hex('#00CED1'), label: 'FACE_TRACKER', colorString: 'darkturquoise' }, // Dark Turquoise
  TOUCHOSC: { color: chalk.hex('#8b5cf6'), label: 'TOUCHOSC', colorString: 'violet' }, // Violet/Purple
};

export type LogType = keyof typeof logTypes;

interface LogOptions {
  quiet?: boolean; // If true, don't output to console unless it's an error
  skipFile?: boolean; // If true, skip writing to the log file
  verboseOnly?: boolean; // If true, only show when verbose mode is enabled
}

// Default logging level
let verboseMode = false;

export function setVerboseMode(enabled: boolean): void {
  verboseMode = enabled;
  console.log(chalk.cyan(`Verbose logging ${enabled ? 'enabled' : 'disabled'}`));
}

export function log(message: string, type: LogType = 'INFO', data?: any, explicitOptions?: LogOptions): void {
  // Extract options if present (from data object or explicit parameter)
  const options: LogOptions = explicitOptions || {};
  if (data && typeof data === 'object' && 'quiet' in data) {
    options.quiet = data.quiet;
    delete data.quiet;
  }
  if (data && typeof data === 'object' && 'skipFile' in data) {
    options.skipFile = data.skipFile;
    delete data.skipFile;
  }
  if (data && typeof data === 'object' && 'verboseOnly' in data) {
    options.verboseOnly = data.verboseOnly;
    delete data.verboseOnly;
  }
  // Merge explicit options (they take precedence)
  if (explicitOptions) {
    if (explicitOptions.quiet !== undefined) options.quiet = explicitOptions.quiet;
    if (explicitOptions.skipFile !== undefined) options.skipFile = explicitOptions.skipFile;
    if (explicitOptions.verboseOnly !== undefined) options.verboseOnly = explicitOptions.verboseOnly;
  }

  // Skip verbose-only logs if not in verbose mode
  if (options.verboseOnly && !verboseMode) {
    return;
  }

  // Simple time format (HH:MM:SS) instead of full ISO timestamp
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0]; // Gets HH:MM:SS
  const timestamp = timeStr;
  const logConfig = logTypes[type] || logTypes.INFO;

  // Format data nicely if present
  let dataStr = '';
  if (data) {
    // Only include meaningful data (skip empty objects, arrays with just defaults, etc.)
    const dataObj = typeof data === 'object' ? data : { value: data };
    const keys = Object.keys(dataObj);
    
    // Filter out noisy/unnecessary data
    if (keys.length > 0) {
      // Create a compact summary instead of full JSON dump
      try {
        const summary: string[] = [];
        for (const [key, value] of Object.entries(dataObj)) {
          // Skip noisy data
          if (key === 'socketId' || key === 'stack' || key === 'info' || 
              (Array.isArray(value) && value.length > 10 && key !== 'fixtures' && key !== 'groups' && key !== 'scenes' && key !== 'acts')) {
            continue;
          }
          
          // Special formatting for OSC and MIDI
          if (key === 'address' && typeof value === 'string') {
            summary.push(value);
            continue;
          }
          if (key === 'value' && typeof value === 'number') {
            summary.push(`val:${value}`);
            continue;
          }
          if (key === 'channel' && typeof value === 'number') {
            summary.push(`ch${value}`);
            continue;
          }
          if (key === 'from' && typeof value === 'number') {
            // Don't add "from" separately, it will be combined with "to"
            continue;
          }
          if (key === 'to' && typeof value === 'number') {
            // Check if we have a "from" value to show transition
            const fromValue = dataObj.from;
            if (typeof fromValue === 'number') {
              summary.push(`${fromValue}→${value}`);
            } else {
              summary.push(`→${value}`);
            }
            continue;
          }
          if (key === 'note' && typeof value === 'number') {
            summary.push(`note:${value}`);
            continue;
          }
          if (key === 'controller' && typeof value === 'number') {
            summary.push(`cc:${value}`);
            continue;
          }
          if (key === 'velocity' && typeof value === 'number') {
            summary.push(`vel:${value}`);
            continue;
          }
          
          // Format values nicely
          if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            summary.push(`${key}:${value}`);
          } else if (Array.isArray(value)) {
            summary.push(`${key}:${value.length}`);
          } else if (typeof value === 'object' && value !== null) {
            const objKeys = Object.keys(value);
            if (objKeys.length <= 3) {
              summary.push(`${key}:{${objKeys.join(',')}}`);
            } else {
              summary.push(`${key}:${objKeys.length}`);
            }
          }
        }
        if (summary.length > 0) {
          dataStr = ' ' + chalk.dim('(' + summary.join(' ') + ')');
        }
      } catch {
        // Fallback to simple string if formatting fails
        dataStr = '';
      }
    }
  }

  const formattedMessage = `${logConfig.label}: ${message}`;
  const consoleMessage = `${chalk.dim(timestamp)} ${logConfig.color(formattedMessage)}${dataStr}`;
  const fileMessage = `${now.toISOString()} - [${logConfig.label}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;

  // Write to file unless skipFile is true
  if (isLoggingEnabled && !options.skipFile) {
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }
      fs.appendFileSync(LOG_FILE, fileMessage);
    } catch (error) {
      console.error(chalk.red.bold('LOGGER ERROR:'), `Error writing to log file: ${error}`);
      // Fallback to console if file logging fails
      console.log(consoleMessage);
    }
  }

  // Output to console unless quiet mode is requested or console logging is disabled
  if (isConsoleLoggingEnabled &&
    (!options.quiet || type === 'ERROR' || type === 'WARN')) {
    // Only use boxes for critical errors, not SYSTEM messages
    if (type === 'ERROR' && consoleMessage && consoleMessage.trim().length > 0) {
      try {
        // Ensure boxen gets valid parameters - check terminal width
        const terminalWidth = process.stdout.columns || 80;
        const safePadding = Math.min(0.5, Math.floor(terminalWidth / 4));
        console.log(boxen(consoleMessage, { 
          padding: safePadding, 
          margin: 0, 
          borderColor: logConfig.colorString, 
          borderStyle: 'round'
        }));
      } catch (boxenError) {
        // Fallback to simple console output if boxen fails
        console.log(consoleMessage);
      }
    } else {
      console.log(consoleMessage);
    }
  }
}

export function enableLogging(enable: boolean): void {
  isLoggingEnabled = enable;
}

export function enableConsoleLogging(enable: boolean): void {
  isConsoleLoggingEnabled = enable;
}