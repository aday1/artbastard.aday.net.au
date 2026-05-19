#!/usr/bin/env node

import { BridgeClient } from './client';
import { loadConfig, parseArgv } from './config';

async function main(): Promise<void> {
  const argv = parseArgv(process.argv.slice(2));
  const config = loadConfig(argv);

  const client = new BridgeClient(config);

  const shutdown = () => {
    console.log('[bridge] Shutting down');
    client.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await client.start();
}

main().catch((err) => {
  console.error('[bridge] Fatal:', err);
  process.exit(1);
});
