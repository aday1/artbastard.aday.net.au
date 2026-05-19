export interface LinkClockState {
  bpm: number;
  beat: number;
  bar: number;
  isPlaying: boolean;
  source: string;
  linkPeers: number;
}

type LinkCtor = new (bpm?: number) => {
  enable: (on: boolean) => void;
  bpm: number;
  beat: number;
  phase: number;
  numPeers?: number;
  peers?: number;
};

export class AbletonLinkSession {
  private link: InstanceType<LinkCtor> | null = null;
  private available = false;
  private enabled = false;
  private lastBeatInt = 0;
  private bar = 1;
  private beat = 1;
  private timeSig = 4;

  async init(initialBpm = 120): Promise<boolean> {
    try {
      const mod = await import('abletonlink');
      const AbletonLink = (mod.default ?? mod) as LinkCtor;
      this.link = new AbletonLink(initialBpm);
      this.link.enable(true);
      this.available = true;
      this.enabled = true;
      this.lastBeatInt = Math.floor(this.link.beat);
      return true;
    } catch (err) {
      console.warn('[bridge] Ableton Link not available:', (err as Error).message);
      this.available = false;
      return false;
    }
  }

  shutdown(): void {
    if (this.link) {
      try {
        this.link.enable(false);
      } catch {
        /* ignore */
      }
      this.link = null;
    }
    this.available = false;
    this.enabled = false;
  }

  isAvailable(): boolean {
    return this.available;
  }

  snapshot(): LinkClockState {
    if (!this.link || !this.available) {
      return {
        bpm: 120,
        beat: 1,
        bar: 1,
        isPlaying: false,
        source: 'ableton-link',
        linkPeers: 0,
      };
    }

    const beatInt = Math.floor(this.link.beat);
    if (beatInt !== this.lastBeatInt) {
      this.lastBeatInt = beatInt;
      this.beat++;
      if (this.beat > this.timeSig) {
        this.beat = 1;
        this.bar++;
      }
    }

    const peers = this.link.numPeers ?? this.link.peers ?? 0;
    return {
      bpm: this.link.bpm,
      beat: this.beat,
      bar: this.bar,
      isPlaying: peers > 0 || true,
      source: 'ableton-link',
      linkPeers: peers,
    };
  }
}
