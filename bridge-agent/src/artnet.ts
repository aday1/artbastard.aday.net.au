import dmxnet from 'dmxnet';

export interface ArtNetConfig {
  ip: string;
  port: number;
  net: number;
  subnet: number;
  universe: number;
  base_refresh_interval: number;
}

export class ArtNetOutput {
  private sender: any = null;
  private channels: number[] = new Array(512).fill(0);
  private config: ArtNetConfig;
  private status: 'ok' | 'error' | 'idle' = 'idle';

  constructor(config: ArtNetConfig) {
    this.config = { ...config };
  }

  reconfigure(config: Partial<ArtNetConfig>): void {
    this.config = { ...this.config, ...config };
    this.init();
  }

  init(): void {
    try {
      if (this.sender && typeof this.sender.close === 'function') {
        this.sender.close();
      }
      const instance = new (dmxnet as any).dmxnet({
        oem: 0,
        sName: 'ArtBastardBridge',
        lName: 'ArtBastard LAN Bridge',
        log: { level: 'none' },
      });
      this.sender = instance.newSender({
        ip: this.config.ip,
        subnet: this.config.subnet,
        universe: this.config.universe,
        net: this.config.net,
        port: this.config.port,
        base_refresh_interval: this.config.base_refresh_interval,
      });
      this.status = 'ok';
    } catch (err) {
      this.status = 'error';
      console.error('[bridge] Art-Net init failed:', err);
    }
  }

  setChannel(index: number, value: number): void {
    if (index < 0 || index >= 512) return;
    this.channels[index] = Math.max(0, Math.min(255, value));
  }

  applyBatch(updates: Record<string, number>): void {
    for (const [chStr, val] of Object.entries(updates)) {
      const ch = parseInt(chStr, 10);
      if (!Number.isNaN(ch) && typeof val === 'number') {
        this.setChannel(ch, val);
      }
    }
  }

  setFullUniverse(channels: number[]): void {
    for (let i = 0; i < 512 && i < channels.length; i++) {
      this.setChannel(i, channels[i] ?? 0);
    }
  }

  transmit(): void {
    if (!this.sender) return;
    try {
      for (let i = 0; i < 512; i++) {
        this.sender.setChannel(i, this.channels[i]);
      }
      this.sender.transmit();
      this.status = 'ok';
    } catch (err) {
      this.status = 'error';
    }
  }

  blackout(): void {
    this.channels.fill(0);
    this.transmit();
  }

  getStatus(): string {
    return this.status;
  }

  getTargetLabel(): string {
    return `${this.config.ip}:${this.config.port} u${this.config.universe}`;
  }
}
