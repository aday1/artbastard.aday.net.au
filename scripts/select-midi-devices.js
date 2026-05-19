#!/usr/bin/env node

/**
 * Interactive MIDI Device Selector
 * Shows a menu of available MIDI devices and allows selection
 * Saves selected devices to config.json for auto-connect on startup
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Try to load easymidi, but handle gracefully if not available
let easymidi;
try {
    easymidi = require('easymidi');
} catch (error) {
    console.error('❌ Error: easymidi module not found. Please run: npm install');
    process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing config
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('⚠️  Error reading config file, creating new one...');
            return {};
        }
    }
    return {};
}

// Save config
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('❌ Error saving config:', error.message);
        return false;
    }
}

// Get available MIDI inputs
function getMidiInputs() {
    try {
        return easymidi.getInputs();
    } catch (error) {
        console.error('❌ Error detecting MIDI devices:', error.message);
        if (error.message.includes('Cannot find module') || error.message.includes('native')) {
            console.error('   Try running: npm rebuild easymidi');
        }
        return [];
    }
}

// Main menu function
function showMenu() {
    const inputs = getMidiInputs();
    const config = loadConfig();
    const currentAutoConnect = config.autoConnectMidiDevices || [];
    
    // Filter saved devices to only include those that are currently available
    const validSavedDevices = currentAutoConnect.filter(device => inputs.includes(device));

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          🎹 MIDI Device Auto-Connect Configuration 🎹          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    if (inputs.length === 0) {
        console.log('⚠️  No MIDI devices detected.');
        console.log('');
        console.log('   Make sure your MIDI devices are:');
        console.log('   • Connected and powered on');
        console.log('   • Recognized by your operating system');
        console.log('   • Drivers installed (if required)');
        console.log('');
        console.log('   On Windows: Check Device Manager');
        console.log('   On Linux: Check with: arecordmidi -l');
        console.log('   On macOS: Check Audio MIDI Setup');
        console.log('');
        process.exit(0);
    }

    console.log('📋 Available MIDI Devices:');
    console.log('');
    
    inputs.forEach((input, index) => {
        const isSelected = validSavedDevices.includes(input);
        const marker = isSelected ? '✓' : ' ';
        const status = isSelected ? '(will auto-connect)' : '';
        console.log(`   ${marker} [${index + 1}] ${input} ${status}`);
    });

    console.log('');
    console.log('📝 Last Saved Selection:');
    if (validSavedDevices.length === 0) {
        console.log('   None (devices must be connected manually)');
        if (currentAutoConnect.length > 0 && validSavedDevices.length === 0) {
            console.log(`   ⚠️  Note: ${currentAutoConnect.length} previously saved device(s) not currently available`);
        }
    } else {
        validSavedDevices.forEach((device, index) => {
            console.log(`   ${index + 1}. ${device}`);
        });
        if (currentAutoConnect.length > validSavedDevices.length) {
            const missing = currentAutoConnect.filter(d => !inputs.includes(d));
            console.log(`   ⚠️  ${missing.length} previously saved device(s) not currently available: ${missing.join(', ')}`);
        }
    }

    console.log('');
    console.log('💡 Instructions:');
    console.log('   • Enter device numbers to toggle selection (e.g., "1" or "1,2,3" or "1 2 3")');
    console.log('   • Enter "all" to select all devices');
    console.log('   • Enter "clear" to deselect all devices');
    console.log('   • Enter "skip" or press Enter to keep current selection');
    console.log('   • Enter "exit" to cancel');
    console.log('   • Wait 5 seconds to auto-select last saved devices');
    console.log('');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let answered = false;
    let countdown = 5;
    let timerInterval = null;
    let timeoutId = null;
    let promptText = '   Your selection (auto-select in 5s): ';

    // Function to update the prompt with countdown
    const updatePrompt = () => {
        if (!answered) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            promptText = `   Your selection (auto-select in ${countdown}s): `;
            process.stdout.write(promptText);
        }
    };

    // Function to handle auto-select
    const doAutoSelect = () => {
        if (!answered) {
            clearInterval(timerInterval);
            clearTimeout(timeoutId);
            answered = true;
            rl.close();
            // Clear the prompt line
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            console.log(''); // New line after prompt
            if (validSavedDevices.length > 0) {
                console.log(`⏱️  Auto-selecting last saved devices (${validSavedDevices.length} device(s))...`);
            }
            handleSelection('', inputs, validSavedDevices, true); // Pass true to indicate auto-select
        }
    };

    // Start countdown
    updatePrompt();
    timerInterval = setInterval(() => {
        countdown--;
        if (countdown > 0 && !answered) {
            updatePrompt();
        } else if (countdown <= 0 && !answered) {
            doAutoSelect();
        }
    }, 1000);

    // Set timeout as backup (slightly longer to ensure it fires)
    timeoutId = setTimeout(() => {
        doAutoSelect();
    }, 5100);

    rl.question(promptText, (answer) => {
        if (!answered) {
            clearInterval(timerInterval);
            clearTimeout(timeoutId);
            answered = true;
            rl.close();
            handleSelection(answer.trim(), inputs, validSavedDevices, false);
        }
    });
}

// Handle user selection
function handleSelection(input, availableInputs, currentSelection, isAutoSelect = false) {
    if (!input || input.toLowerCase() === 'skip' || input.toLowerCase() === '') {
        if (isAutoSelect) {
            // Auto-select: use the last saved devices
            const config = loadConfig();
            // Filter to only include devices that are currently available
            const validDevices = (config.autoConnectMidiDevices || []).filter(device => availableInputs.includes(device));
            
            if (validDevices.length === 0) {
                console.log('');
                console.log('✅ No valid saved devices to auto-connect.');
                console.log('   (No devices were previously saved, or saved devices are not currently available)');
                process.exit(0);
            }
            
            // Save the filtered list (in case some devices are no longer available)
            config.autoConnectMidiDevices = validDevices;
            if (saveConfig(config)) {
                console.log('');
                console.log(`✅ Auto-selected ${validDevices.length} previously saved device(s):`);
                validDevices.forEach((device, index) => {
                    console.log(`   ${index + 1}. ${device}`);
                });
            } else {
                console.log('');
                console.log('❌ Failed to save configuration.');
                process.exit(1);
            }
        } else {
            console.log('');
            console.log('✅ Keeping current selection.');
        }
        process.exit(0);
    }

    if (input.toLowerCase() === 'exit') {
        console.log('');
        console.log('❌ Cancelled.');
        process.exit(1);
    }

    if (input.toLowerCase() === 'clear') {
        const config = loadConfig();
        config.autoConnectMidiDevices = [];
        if (saveConfig(config)) {
            console.log('');
            console.log('✅ Cleared all auto-connect devices.');
        } else {
            console.log('');
            console.log('❌ Failed to save configuration.');
            process.exit(1);
        }
        process.exit(0);
    }

    if (input.toLowerCase() === 'all') {
        const config = loadConfig();
        config.autoConnectMidiDevices = [...availableInputs];
        if (saveConfig(config)) {
            console.log('');
            console.log(`✅ Selected all ${availableInputs.length} device(s) for auto-connect.`);
        } else {
            console.log('');
            console.log('❌ Failed to save configuration.');
            process.exit(1);
        }
        process.exit(0);
    }

    // Parse numbers (support both comma and space separated)
    const numbers = input.split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0);

    if (numbers.length === 0) {
        console.log('');
        console.log('❌ Invalid input. Please enter device numbers.');
        process.exit(1);
    }

    // Validate numbers are in range
    const invalidNumbers = numbers.filter(n => n < 1 || n > availableInputs.length);
    if (invalidNumbers.length > 0) {
        console.log('');
        console.log(`❌ Invalid device numbers: ${invalidNumbers.join(', ')}`);
        console.log(`   Please enter numbers between 1 and ${availableInputs.length}`);
        process.exit(1);
    }

    // Toggle selection for each number
    const newSelection = [...currentSelection];
    numbers.forEach(num => {
        const deviceName = availableInputs[num - 1];
        const index = newSelection.indexOf(deviceName);
        if (index >= 0) {
            // Remove if already selected
            newSelection.splice(index, 1);
        } else {
            // Add if not selected
            newSelection.push(deviceName);
        }
    });

    // Save configuration
    const config = loadConfig();
    config.autoConnectMidiDevices = newSelection;
    if (saveConfig(config)) {
        console.log('');
        if (newSelection.length === 0) {
            console.log('✅ Cleared all auto-connect devices.');
        } else {
            console.log(`✅ Updated auto-connect devices (${newSelection.length} selected):`);
            newSelection.forEach((device, index) => {
                console.log(`   ${index + 1}. ${device}`);
            });
        }
    } else {
        console.log('');
        console.log('❌ Failed to save configuration.');
        process.exit(1);
    }

    process.exit(0);
}

// Run the menu
showMenu();

