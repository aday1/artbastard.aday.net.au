import { io, Socket } from 'socket.io-client';
import { ArtNetOutput, ArtNetConfig } from './artnet';
import { BridgeConfig } from './config';
import { AbletonLinkSession } from './link';

const PACKAGE_VERSION = '1.0.0';

export class BridgeClient {
  private socket: Socket | null = null;
  private config: BridgeConfig;
  private artnet: ArtNetOutput;
  private link: AbletonLinkSession;
  private pendingBatch: Record<number, number> = {};
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private linkTimer: ReturnType<typeof setInterval> | null = null;
  private cloudWatchdog: ReturnType<typeof setInterval> | null = null;
  private lastCloudMessageAt = Date.now();
  private reconnectAttempt = 0;
  private running = false;
  private lastSeq = 0;

  constructor(config: BridgeConfig) {
    this.config = config;
    this.artnet = new ArtNetOutput(config.artnet);
    this.link = new AbletonLinkSession();
  }

  async start(): Promise<void> {
    if (!this.config.token) {
      throw new Error('Bridge token required. Set BRIDGE_TOKEN or --token, or ~/.artbastard/bridge.json');
    }
    this.running = true;
    this.artnet.init();
    if (this.config.linkEnabled) {
      await this.link.init();
    }
    this.startFlushLoop();
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.clearTimers();
    this.link.shutdown();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startFlushLoop(): void {
    const intervalMs = Math.max(10, Math.floor(1000 / this.config.dmxFlushHz));
    this.flushTimer = setInterval(() => {
      if (Object.keys(this.pendingBatch).length === 0) return;
      const batch = { ...this.pendingBatch };
      this.pendingBatch = {};
      this.artnet.applyBatch(
        Object.fromEntries(Object.entries(batch).map(([k, v]) => [k, v]))
      );
      this.artnet.transmit();
    }, intervalMs);
  }

  private connect(): void {
    const url = this.config.cloudUrl.replace(/\/$/, '');
    console.log(`[bridge] Connecting to ${url} as ${this.config.bridgeId}`);

    this.socket = io(url, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: this.config.token, role: 'bridge' },
      reconnection: false,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempt = 0;
      this.lastCloudMessageAt = Date.now();
      console.log('[bridge] Connected', this.socket?.id);
      this.emitHello();
      this.startHeartbeat();
      this.startCloudWatchdog();
      if (this.config.linkEnabled && this.link.isAvailable()) {
        this.startLinkPolling();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[bridge] Disconnected:', reason);
      this.clearSocketTimers();
      this.scheduleReconnect();
    });

    this.socket.on('connect_error', (err) => {
      console.error('[bridge] Connect error:', err.message);
      this.scheduleReconnect();
    });

    this.socket.on('bridge:dmx:set', (payload: {
      universe?: number;
      channels?: number[];
      seq?: number;
      ts?: number;
    }) => {
      this.touchCloud();
      if (payload?.channels && Array.isArray(payload.channels)) {
        this.artnet.setFullUniverse(payload.channels);
        if (payload.seq) this.lastSeq = payload.seq;
      }
    });

    this.socket.on('bridge:dmx:batch', (payload: {
      updates?: Record<string, number>;
      seq?: number;
      ts?: number;
    }) => {
      this.touchCloud();
      if (!payload?.updates) return;
      for (const [chStr, val] of Object.entries(payload.updates)) {
        const ch = parseInt(chStr, 10);
        if (!Number.isNaN(ch) && typeof val === 'number') {
          this.pendingBatch[ch] = val;
        }
      }
      if (payload.seq) this.lastSeq = payload.seq;
    });

    this.socket.on('bridge:config:artnet', (cfg: Partial<ArtNetConfig>) => {
      this.touchCloud();
      console.log('[bridge] Art-Net config push:', cfg);
      this.artnet.reconfigure(cfg);
    });

    this.socket.on('bridge:clock:request', () => {
      this.touchCloud();
      this.emitClockState();
    });
  }

  private touchCloud(): void {
    this.lastCloudMessageAt = Date.now();
  }

  private emitHello(): void {
    const caps = ['artnet', 'dmx'];
    if (this.config.linkEnabled) caps.push('ableton-link');
    this.socket?.emit('bridge:hello', {
      bridgeId: this.config.bridgeId,
      version: PACKAGE_VERSION,
      caps,
    });
    this.emitStatus();
  }

  private emitStatus(): void {
    this.socket?.emit('bridge:status', {
      artnet: { status: this.artnet.getStatus(), target: this.artnet.getTargetLabel() },
      link: { available: this.link.isAvailable(), peers: this.link.snapshot().linkPeers },
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const snap = this.link.snapshot();
      this.socket?.emit('bridge:heartbeat', {
        seq: this.lastSeq,
        artnetStatus: this.artnet.getStatus(),
        linkPeers: snap.linkPeers,
      });
    }, 2000);
  }

  private startLinkPolling(): void {
    this.linkTimer = setInterval(() => this.emitClockState(), 50);
  }

  private emitClockState(): void {
    const state = this.link.snapshot();
    this.socket?.emit('bridge:clock:state', state);
  }

  private startCloudWatchdog(): void {
    this.cloudWatchdog = setInterval(() => {
      if (Date.now() - this.lastCloudMessageAt > this.config.cloudPingTimeoutMs) {
        console.warn('[bridge] Cloud silent - applying safety mode:', this.config.safetyMode);
        if (this.config.safetyMode === 'blackout') {
          this.artnet.blackout();
        }
      }
    }, 500);
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    this.clearSocketTimers();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt++;
    console.log(`[bridge] Reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`);
    setTimeout(() => {
      if (this.running) this.connect();
    }, delay);
  }

  private clearSocketTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.linkTimer) clearInterval(this.linkTimer);
    if (this.cloudWatchdog) clearInterval(this.cloudWatchdog);
    this.heartbeatTimer = null;
    this.linkTimer = null;
    this.cloudWatchdog = null;
  }

  private clearTimers(): void {
    this.clearSocketTimers();
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
  }
}
