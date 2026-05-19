import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const REVOKED_FILE = path.join(DATA_DIR, 'bridge-revoked.json');

function getSecret(): string {
  return (
    process.env.BRIDGE_TOKEN_SECRET ||
    process.env.ARTBASTARD_BRIDGE_SECRET ||
    'artbastard-bridge-dev-secret-change-in-production'
  );
}

export interface BridgeTokenPayload {
  role: 'bridge';
  bridgeId: string;
  sessionId: string;
  exp: number;
}

function b64urlEncode(data: string): string {
  return Buffer.from(data, 'utf-8').toString('base64url');
}

function b64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

export function mintBridgeToken(
  bridgeId: string,
  sessionId: string,
  expiresInSec = 60 * 60 * 24 * 30
): string {
  const exp = Date.now() + expiresInSec * 1000;
  const payload: BridgeTokenPayload = { role: 'bridge', bridgeId, sessionId, exp };
  const payloadStr = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadStr).digest('base64url');
  return `${b64urlEncode(payloadStr)}.${sig}`;
}

export function verifyBridgeToken(token: string): BridgeTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  let payloadStr: string;
  try {
    payloadStr = b64urlDecode(payloadB64);
  } catch {
    return null;
  }
  const expected = crypto.createHmac('sha256', getSecret()).update(payloadStr).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let payload: BridgeTokenPayload;
  try {
    payload = JSON.parse(payloadStr) as BridgeTokenPayload;
  } catch {
    return null;
  }
  if (payload.role !== 'bridge' || !payload.bridgeId) return null;
  if (!payload.sessionId) {
    payload.sessionId = 'default';
  }
  if (payload.exp < Date.now()) return null;
  if (isTokenRevoked(token)) return null;
  return payload;
}

function loadRevoked(): string[] {
  try {
    if (fs.existsSync(REVOKED_FILE)) {
      const data = JSON.parse(fs.readFileSync(REVOKED_FILE, 'utf-8'));
      return Array.isArray(data.tokens) ? data.tokens : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveRevoked(tokens: string[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(REVOKED_FILE, JSON.stringify({ tokens, updatedAt: new Date().toISOString() }, null, 2));
}

function isTokenRevoked(token: string): boolean {
  return loadRevoked().includes(token);
}

export function revokeBridgeToken(token: string): void {
  const tokens = loadRevoked();
  if (!tokens.includes(token)) {
    tokens.push(token);
    saveRevoked(tokens);
  }
}

export function hashTokenForDisplay(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}
