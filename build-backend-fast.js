#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('⚡ Fast backend build...');

try {
  // Skip TypeScript installation check if already exists
  const tscPath = path.join(__dirname, 'node_modules', 'typescript', 'bin', 'tsc');
  
  if (!fs.existsSync(tscPath)) {
    console.log('Installing TypeScript...');
    execSync('npm install typescript --save-dev --prefer-offline --legacy-peer-deps', { stdio: 'inherit' });
  }
  
  // Fast TypeScript compilation with optimizations
  execSync(`node ${tscPath} --incremental --tsBuildInfoFile .tsbuildinfo`, { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  // Skip static file copying if not needed for dev
  const staticDir = path.join(__dirname, 'src', 'public');
  if (fs.existsSync(staticDir) && process.env.NODE_ENV === 'production') {
    console.log('Copying static files...');
    execSync('npx copyfiles -u 1 src/public/**/* dist', { stdio: 'inherit' });
  }
  
  console.log('✅ Fast backend build complete!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
