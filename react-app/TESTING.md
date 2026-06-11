# ArtBastard Testing Guide

## Overview

ArtBastard uses a **build & run** testing approach - if it builds and runs, the test is successful.

## Running Build Test

```bash
# From project root - test the full build
npm run build

# Or use the start script (which includes build)
./start.sh
```

## CI/CD Build Test

The GitHub Actions workflow (`.github/workflows/test.yml`) automatically:
1. ✅ Installs all dependencies
2. ✅ Builds the backend (`npm run build-backend`)
3. ✅ Builds the frontend (`npm run build-frontend`)
4. ✅ Verifies build artifacts exist
5. ✅ Tests server startup

**If all steps pass, the test is successful!**

## What Gets Tested

- ✅ Backend TypeScript compilation
- ✅ Frontend React/Vite build
- ✅ All dependencies resolve correctly
- ✅ Build artifacts are generated
- ✅ Server can start without errors

## Running Locally

```bash
# Fast start (smart rebuild)
./start.sh

# Full clean rebuild
./start.sh -Clear

# Factory reset (clears saved state)
./start.sh -Reset
```

## Optional: Unit Tests

If you want to add unit tests later, Vitest is already set up:

```bash
cd react-app
npm test              # Run unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

But for now, **build success = test success** ✅

