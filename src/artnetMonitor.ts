export interface ArtNetPingSample {
  ts: number;
  iso: string;
  ip: string;
  status: string;
  ok: boolean;
  latencyMs: number | null;
  message?: string;
}

const MAX_HISTORY = 120;
const history: ArtNetPingSample[] = [];

const normalizeLatencyMs = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
  }
  return null;
};

export const recordArtNetPingSample = (sample: Omit<ArtNetPingSample, 'ts' | 'iso' | 'ok' | 'latencyMs'> & {
  latencyMs?: unknown;
  ok?: boolean;
}): ArtNetPingSample => {
  const ts = Date.now();
  const next: ArtNetPingSample = {
    ts,
    iso: new Date(ts).toISOString(),
    ip: sample.ip,
    status: sample.status,
    ok: sample.ok ?? sample.status === 'alive',
    latencyMs: normalizeLatencyMs(sample.latencyMs),
    ...(sample.message ? { message: sample.message } : {}),
  };

  history.push(next);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  return next;
};

export const getArtNetPingHistory = (): ArtNetPingSample[] => [...history];

export const getLastArtNetPing = (): ArtNetPingSample | null => history[history.length - 1] ?? null;