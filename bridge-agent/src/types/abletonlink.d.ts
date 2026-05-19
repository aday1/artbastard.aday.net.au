declare module 'abletonlink' {
  const AbletonLink: new (bpm?: number) => {
    enable: (on: boolean) => void;
    bpm: number;
    beat: number;
    phase: number;
    numPeers?: number;
    peers?: number;
  };
  export default AbletonLink;
}
