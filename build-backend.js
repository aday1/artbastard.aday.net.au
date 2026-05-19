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
