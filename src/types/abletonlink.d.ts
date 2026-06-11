declare module 'abletonlink' {
  export default class AbletonLink {
    constructor(bpm?: number);
    enable(enabled: boolean): void;
    bpm: number;
    beat: number;
    phase: number;
    numPeers?: number;
    peers?: number;
  }
}
