// Optional Ableton Link bridge (native module). Gracefully no-ops when not installed.

export interface AbletonLinkSnapshot {
  bpm: number;
  beat: number;
  phase: number;
  peers: number;
  enabled: boolean;
  available: boolean;
}

type LinkCtor = new (bpm?: number) => {
  enable: (on: boolean) => void;
  bpm: number;
  beat: number;
  phase: number;
  numPeers?: number;
  peers?: number;
};

let linkInstance: InstanceType<LinkCtor> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let moduleAvailable = false;

const defaultSnapshot = (): AbletonLinkSnapshot => ({
  bpm: 120,
  beat: 1,
  phase: 0,
  peers: 0,
  enabled: false,
  available: false,
});

let latestSnapshot: AbletonLinkSnapshot = defaultSnapshot();

export function getAbletonLinkSnapshot(): AbletonLinkSnapshot {
  return latestSnapshot;
}

export function isAbletonLinkModuleAvailable(): boolean {
  return moduleAvailable;
}

export async function initAbletonLinkBridge(initialBpm = 120): Promise<boolean> {
  if (linkInstance) {
    return moduleAvailable;
  }

  try {
    const mod = await import('abletonlink');
    const AbletonLink = (mod.default ?? mod) as LinkCtor;
    linkInstance = new AbletonLink(initialBpm);
    linkInstance.enable(true);
    moduleAvailable = true;
    latestSnapshot = {
      bpm: linkInstance.bpm,
      beat: linkInstance.beat,
      phase: linkInstance.phase,
      peers: linkInstance.numPeers ?? linkInstance.peers ?? 0,
      enabled: true,
      available: true,
    };
    return true;
  } catch (err) {
    console.warn(
      'Ableton Link module not available. Install optional dependency "abletonlink" and rebuild native addons.',
      err
    );
    moduleAvailable = false;
    latestSnapshot = defaultSnapshot();
    return false;
  }
}

export function startAbletonLinkPolling(
  onTick: (snapshot: AbletonLinkSnapshot) => void,
  intervalMs = 50
): void {
  stopAbletonLinkPolling();
  if (!linkInstance) return;

  pollTimer = setInterval(() => {
    if (!linkInstance) return;
    latestSnapshot = {
      bpm: linkInstance.bpm,
      beat: linkInstance.beat,
      phase: linkInstance.phase,
      peers: linkInstance.numPeers ?? linkInstance.peers ?? 0,
      enabled: true,
      available: true,
    };
    onTick(latestSnapshot);
  }, intervalMs);
}

export function stopAbletonLinkPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function shutdownAbletonLinkBridge(): void {
  stopAbletonLinkPolling();
  if (linkInstance) {
    try {
      linkInstance.enable(false);
    } catch {
      /* ignore */
    }
    linkInstance = null;
  }
  moduleAvailable = false;
  latestSnapshot = defaultSnapshot();
}

export function setAbletonLinkBpm(bpm: number): boolean {
  if (!linkInstance || bpm <= 0) return false;
  try {
    linkInstance.bpm = bpm;
    latestSnapshot = { ...latestSnapshot, bpm: linkInstance.bpm };
    return true;
  } catch {
    return false;
  }
}
