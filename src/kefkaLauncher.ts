import express, { Request } from 'express';
import { execFile } from 'child_process';
import { isIP } from 'net';
import os from 'os';
import path from 'path';

type LauncherEnvironment = NodeJS.ProcessEnv;
type LauncherOptions = {
  timeout: number;
  maxBuffer: number;
  shell: false;
};
type RunLauncher = (file: string, args: string[], options: LauncherOptions) => Promise<void>;

const runLauncher: RunLauncher = (file, args, options) => new Promise((resolve, reject) => {
  execFile(file, args, options, error => {
    if (error) reject(error);
    else resolve();
  });
});

export function isKefkaLoopback(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  return normalized === '::1' || (isIP(normalized) === 4 && normalized.startsWith('127.'));
}

export function isKefkaEnabled(
  environment: LauncherEnvironment,
  remoteAddress: string | undefined
): boolean {
  return environment.ARTBASTARD_KEFKA === '1' && isKefkaLoopback(remoteAddress);
}

export function isKefkaLaunchOrigin(
  environment: LauncherEnvironment,
  host: string | undefined,
  origin: string | undefined
): boolean {
  const port = environment.PORT || '3030';
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  // Use configured addresses, never a request-supplied Host to build the allowlist.
  // Requiring the matching Host also excludes cross-origin local requests.
  return typeof host === 'string' && allowedHosts.includes(host) &&
    origin === `http://${host}`;
}

/** The injected executor is only for isolated tests; requests cannot choose commands. */
export function createKefkaSurfaceRouter({
  environment = process.env,
  homeDirectory = os.homedir(),
  runFile = runLauncher,
}: {
  environment?: LauncherEnvironment;
  homeDirectory?: string;
  runFile?: RunLauncher;
} = {}) {
  const router = express.Router();
  const enabledFor = (req: Request) => isKefkaEnabled(environment, req.socket.remoteAddress);
  const launchers = {
    deck: path.join(homeDirectory, '.local', 'bin', 'artbastard-deck-open'),
    console: path.join(homeDirectory, '.local', 'bin', 'artbastard-console-open'),
  };

  router.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ enabled: enabledFor(req) });
  });

  router.post('/:surface', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!enabledFor(req) || !isKefkaLaunchOrigin(environment, req.get('Host'), req.get('Origin'))) {
      res.status(403).json({ success: false, error: 'Local surface launch unavailable' });
      return;
    }
    const surface = req.params.surface;
    if (surface !== 'deck' && surface !== 'console') {
      res.status(400).json({ success: false, error: 'Invalid surface' });
      return;
    }
    try {
      await runFile(launchers[surface], [], { timeout: 10000, maxBuffer: 65536, shell: false });
      res.json({ success: true });
    } catch {
      res.status(503).json({ success: false, error: 'Surface launch failed' });
    }
  });

  return router;
}
