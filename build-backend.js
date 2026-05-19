#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[BUILD] Building backend with local TypeScript compiler...');

try {
  // Ensure typescript is installed
  if (!fs.existsSync(path.join(__dirname, 'node_modules', 'typescript'))) {
    console.log('TypeScript not found, installing...');
    execSync('npm install typescript --save-dev --legacy-peer-deps', { stdio: 'inherit' });
  }

  // Run the TypeScript compiler using the local installation
  execSync('node ./node_modules/typescript/bin/tsc', { stdio: 'inherit' });

  // Copy static files if they exist
  if (fs.existsSync(path.join(__dirname, 'src', 'public'))) {
    console.log('Copying static files...');
    if (!fs.existsSync(path.join(__dirname, 'dist'))) {
      fs.mkdirSync(path.join(__dirname, 'dist'));
    }
    copyDir(path.join(__dirname, 'src', 'public'), path.join(__dirname, 'dist', 'public'));
  }

  console.log('[SUCCESS] Backend build completed successfully!');
} catch (error) {
  console.error('[ERROR] Build failed:', error.message);
  process.exit(1);
}

// Helper function to copy directories recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Fixture Library Implementation

class FixtureLibrary {
  constructor() {
    this.fixtures = [];
    this.loadFixtures();
  }

  // Load fixtures from JSON file
  loadFixtures() {
    try {
      const fixturesPath = path.join(__dirname, 'data', 'fixtures.json');
      if (fs.existsSync(fixturesPath)) {
        const data = fs.readFileSync(fixturesPath, 'utf8');
        this.fixtures = JSON.parse(data);
        console.log(`Loaded ${this.fixtures.length} fixtures from library`);
      }
    } catch (error) {
      console.error('Error loading fixtures:', error.message);
    }
  }

  // Save fixtures to JSON file
  saveFixtures() {
    try {
      const fixturesPath = path.join(__dirname, 'data', 'fixtures.json');
      fs.writeFileSync(fixturesPath, JSON.stringify(this.fixtures, null, 2));
      console.log(`Saved ${this.fixtures.length} fixtures to library`);
    } catch (error) {
      console.error('Error saving fixtures:', error.message);
    }
  }

  // Delete all fixtures
  deleteAllFixtures() {
    this.fixtures = [];
    this.saveFixtures();
    console.log('All fixtures deleted from library');
  }

  // Add fixture
  addFixture(fixture) {
    this.fixtures.push(fixture);
    this.saveFixtures();
    console.log(`Added fixture: ${fixture.name}`);
  }

  // Get fixtures by type
  getFixturesByType(type) {
    return this.fixtures.filter(f => f.type === type);
  }

  // Get fixture by name
  getFixtureByName(name) {
    return this.fixtures.find(f => f.name === name);
  }

  // Switch channel mode for a fixture
  switchChannelMode(fixtureName, modeIndex) {
    const fixture = this.getFixtureByName(fixtureName);
    if (fixture && fixture.modes && fixture.modes[modeIndex]) {
      fixture.currentMode = modeIndex;
      this.saveFixtures();
      console.log(`Switched ${fixtureName} to mode ${fixture.modes[modeIndex].name}`);
      return fixture.modes[modeIndex];
    }
    return null;
  }
}

// Channel Data Import System

class ChannelDataImporter {
  constructor(fixtureLibrary) {
    this.fixtureLibrary = fixtureLibrary;
  }

  // Import channel data from manual text
  importFromManualText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const fixtures = [];
    let currentFixture = null;
    let currentMode = null;

    for (const line of lines) {
      if (line.toUpperCase().startsWith('NAME:')) {
        // New fixture
        if (currentFixture) {
          fixtures.push(currentFixture);
        }
        currentFixture = {
          name: line.replace('NAME:', '').trim(),
          type: 'Unknown',
          description: '',
          modes: []
        };
        currentMode = null;
      } else if (line.toUpperCase().startsWith('DESCRIPTION:')) {
        if (currentFixture) {
          currentFixture.description = line.replace('DESCRIPTION:', '').trim();
        }
      } else if (line.toUpperCase().startsWith('MODES')) {
        // Parse modes
        const modeMatch = line.match(/(\d+)\s*Channel\s*mode/i);
        if (modeMatch && currentFixture) {
          currentMode = {
            channels: parseInt(modeMatch[1]),
            channelData: []
          };
          currentFixture.modes.push(currentMode);
        }
      } else if (line.toUpperCase().startsWith('CHANNEL') && currentMode) {
        // Parse channel
        const channelMatch = line.match(/CHANNEL\s+(\d+)\s*-\s*NAME=(.+)/i);
        if (channelMatch) {
          const channelNum = parseInt(channelMatch[1]);
          const channelName = channelMatch[2].trim();
          const channel = {
            channel: channelNum,
            name: channelName,
            ranges: []
          };
          currentMode.channelData.push(channel);
        }
      } else if (line.includes('-') && currentMode && currentMode.channelData.length > 0) {
        // Parse data ranges
        const lastChannel = currentMode.channelData[currentMode.channelData.length - 1];
        const rangeMatch = line.match(/(\d+)-(\d+):\s*(.+)/);
        if (rangeMatch) {
          lastChannel.ranges.push({
            min: parseInt(rangeMatch[1]),
            max: parseInt(rangeMatch[2]),
            description: rangeMatch[3].trim()
          });
        }
      }
    }

    if (currentFixture) {
      fixtures.push(currentFixture);
    }

    return fixtures;
  }

  // Import and add fixtures to library
  importFixtures(fixtures) {
    for (const fixture of fixtures) {
      this.fixtureLibrary.addFixture(fixture);
    }
  }
}

// Initialize the Fixture Library
const fixtureLibrary = new FixtureLibrary();

// Initialize the Channel Data Importer
const importer = new ChannelDataImporter(fixtureLibrary);

// Delete all existing fixtures
// DO NOT delete fixtures during build - they should be preserved from previous sessions
// fixtureLibrary.deleteAllFixtures(); // REMOVED - preserves fixtures across builds

// Example usage - you can call these functions as needed
// const fixturesFromManual = importer.importFromManualText(manualText);
// importer.importFixtures(fixturesFromManual);

console.log('Fixture Library initialized and ready for use');