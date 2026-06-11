#!/usr/bin/env node

const { platform, arch } = process;
const { execSync } = require('child_process');
const path = require('path');

console.log(`🔍 Detected platform: ${platform}-${arch}`);

// Platform-specific rollup binaries
const rollupBinaries = {
  'win32-x64': '@rollup/rollup-win32-x64-msvc',
  'win32-ia32': '@rollup/rollup-win32-ia32-msvc',
  'win32-arm64': '@rollup/rollup-win32-arm64-msvc',
  'darwin-x64': '@rollup/rollup-darwin-x64',
  'darwin-arm64': '@rollup/rollup-darwin-arm64',
  'linux-x64': '@rollup/rollup-linux-x64-gnu',
  'linux-arm64': '@rollup/rollup-linux-arm64-gnu',
  'linux-arm': '@rollup/rollup-linux-arm-gnueabihf'
};

const platformKey = `${platform}-${arch}`;
const requiredBinary = rollupBinaries[platformKey];

if (requiredBinary) {
  console.log(`📦 Installing platform-specific rollup binary: ${requiredBinary}`);
  try {
    execSync(`npm install ${requiredBinary}@^4.46.3 --save-optional`, { 
      stdio: 'inherit', 
      cwd: __dirname 
    });
    console.log(`✅ Successfully installed ${requiredBinary}`);
  } catch (error) {
    console.warn(`⚠️  Failed to install ${requiredBinary}, falling back to JS implementation`);
    console.log('🔧 Setting FORCE_ROLLUP_JS_FALLBACK=true for builds');
    
    // Create a .env file with fallback setting
    const fs = require('fs');
    const envPath = path.join(__dirname, '.env.local');
    fs.writeFileSync(envPath, 'FORCE_ROLLUP_JS_FALLBACK=true\n', { flag: 'a' });
  }
} else {
  console.warn(`⚠️  Unsupported platform: ${platformKey}`);
  console.log('🔧 Setting FORCE_ROLLUP_JS_FALLBACK=true for builds');
  
  // Create a .env file with fallback setting
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env.local');
  fs.writeFileSync(envPath, 'FORCE_ROLLUP_JS_FALLBACK=true\n', { flag: 'a' });
}

console.log('🎉 Build setup complete!');
