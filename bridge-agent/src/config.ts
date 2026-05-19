import fs from 'fs';
import os from 'os';
import path from 'path';

export interface BridgeConfig {
  cloudUrl: string;
  token: string;
  bridgeId: string;
  /** Optional; session is normally taken from the minted token. */
  sessionId: string;
  artnet: {
    ip: string;
    port: number;
    net: number;
    subnet: number;
    universe: number;
    base_refresh_interval: number;
  };
  safetyMode: 'hold' | 'blackout';
  cloudPingTimeoutMs: number;
  dmxFlushHz: number;
  linkEnabled: boolean;
}

const DEFAULT_CONFIG: BridgeConfig = {
  cloudUrl: 'https://artbastard.aday.net.au',
  token: '',
  bridgeId: `bridge-${os.hostname()}`,
  sessionId: 'default',
  artnet: {
    ip: '192.168.1.199',
    port: 6454,
    net: 0,
    subnet: 0,
    universe: 0,
    base_refresh_interval: 1000,
  },
  safetyMode: 'hold',
  cloudPingTimeoutMs: 3000,
  dmxFlushHz: 40,
  linkEnabled: true,
};

function configPath(): string {
  return (
    process.env.ARTBASTARD_BRIDGE_CONFIG ||
    path.join(os.homedir(), '.artbastard', 'bridge.json')
  );
}

export function loadConfig(argv: Record<string, string | boolean>): BridgeConfig {
  const cfg: BridgeConfig = { ...DEFAULT_CONFIG, artnet: { ...DEFAULT_CONFIG.artnet } };
  const file = configPath();

  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (parsed.cloudUrl) cfg.cloudUrl = parsed.cloudUrl;
      if (parsed.token) cfg.token = parsed.token;
      if (parsed.bridgeId) cfg.bridgeId = parsed.bridgeId;
      if (parsed.sessionId) cfg.sessionId = parsed.sessionId;
      if (parsed.artnet) cfg.artnet = { ...cfg.artnet, ...parsed.artnet };
      if (parsed.safetyMode) cfg.safetyMode = parsed.safetyMode;
      if (typeof parsed.cloudPingTimeoutMs === 'number') cfg.cloudPingTimeoutMs = parsed.cloudPingTimeoutMs;
      if (typeof parsed.dmxFlushHz === 'number') cfg.dmxFlushHz = parsed.dmxFlushHz;
      if (typeof parsed.linkEnabled === 'boolean') cfg.linkEnabled = parsed.linkEnabled;
    } catch (err) {
      console.warn('[bridge] Failed to read config file:', err);
    }
  }

  if (process.env.BRIDGE_TOKEN) cfg.token = process.env.BRIDGE_TOKEN;
  if (process.env.CLOUD_URL) cfg.cloudUrl = process.env.CLOUD_URL;
  if (process.env.ARTNET_IP) cfg.artnet.ip = process.env.ARTNET_IP;
  if (process.env.BRIDGE_ID) cfg.bridgeId = process.env.BRIDGE_ID;
  if (process.env.SESSION_ID) cfg.sessionId = process.env.SESSION_ID;
  if (process.env.BRIDGE_SESSION_ID) cfg.sessionId = process.env.BRIDGE_SESSION_ID;

  if (typeof argv.token === 'string' && argv.token) cfg.token = argv.token;
  if (typeof argv['cloud-url'] === 'string' && argv['cloud-url']) cfg.cloudUrl = argv['cloud-url'];
  if (typeof argv['artnet-ip'] === 'string' && argv['artnet-ip']) cfg.artnet.ip = argv['artnet-ip'];
  if (typeof argv['bridge-id'] === 'string' && argv['bridge-id']) cfg.bridgeId = argv['bridge-id'];
  if (typeof argv['session-id'] === 'string' && argv['session-id']) cfg.sessionId = argv['session-id'];
  if (argv['no-link'] === true) cfg.linkEnabled = false;

  return cfg;
}

export function parseArgv(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-link') {
      out['no-link'] = true;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}
