import React, { useMemo } from 'react';
import styles from './ArtNetPingGraph.module.scss';

export interface ArtNetPingSample {
  ts: number;
  iso?: string;
  ip: string;
  status: string;
  ok: boolean;
  latencyMs: number | null;
  message?: string;
}

interface ArtNetPingGraphProps {
  samples: ArtNetPingSample[];
  targetStatus?: string;
}

const WIDTH = 640;
const HEIGHT = 150;
const PAD_X = 18;
const PAD_Y = 18;

const sampleColor = (sample: ArtNetPingSample) => {
  if (!sample.ok) return '#f97316';
  if ((sample.latencyMs ?? 0) > 80) return '#facc15';
  return '#22c55e';
};

export const ArtNetPingGraph: React.FC<ArtNetPingGraphProps> = ({ samples, targetStatus }) => {
  const view = samples.slice(-80);
  const stats = useMemo(() => {
    const alive = view.filter((sample) => sample.ok);
    const latencies = alive.map((sample) => sample.latencyMs).filter((value): value is number => typeof value === 'number');
    const avg = latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null;
    const successRate = view.length ? Math.round((alive.length / view.length) * 100) : 0;
    const max = Math.max(50, ...latencies, 100);
    return { avg, successRate, max };
  }, [view]);

  const points = view.map((sample, index) => {
    const x = view.length <= 1
      ? PAD_X
      : PAD_X + (index / (view.length - 1)) * (WIDTH - PAD_X * 2);
    const normalized = sample.ok && sample.latencyMs !== null
      ? Math.min(1, sample.latencyMs / stats.max)
      : 1;
    const y = PAD_Y + normalized * (HEIGHT - PAD_Y * 2);
    return { sample, x, y };
  });

  const line = points
    .filter((point) => point.sample.ok)
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');

  return (
    <section className={styles.graph} aria-label="ArtNet ping history">
      <div className={styles.graphHeader}>
        <div>
          <strong>ArtNet target ping</strong>
          <span>{view.at(-1)?.ip ?? 'No target sampled yet'} · {targetStatus ?? view.at(-1)?.status ?? 'unknown'}</span>
        </div>
        <div className={styles.stats}>
          <span>{stats.successRate}% reply</span>
          <span>{stats.avg === null ? 'avg -- ms' : `avg ${Math.round(stats.avg)} ms`}</span>
          <span>{view.length} samples</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="ArtNet latency graph">
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="8" />
        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={HEIGHT - PAD_Y} y2={HEIGHT - PAD_Y} className={styles.axis} />
        <line x1={PAD_X} x2={PAD_X} y1={PAD_Y} y2={HEIGHT - PAD_Y} className={styles.axis} />
        {points.map(({ sample, x, y }, index) => (
          <line
            key={`${sample.ts}-${index}`}
            x1={x}
            x2={x}
            y1={sample.ok ? y : PAD_Y}
            y2={HEIGHT - PAD_Y}
            stroke={sampleColor(sample)}
            strokeWidth={sample.ok ? 3 : 5}
            opacity={sample.ok ? 0.82 : 0.95}
          />
        ))}
        {line && <polyline points={line} className={styles.latencyLine} />}
      </svg>
    </section>
  );
};

export default ArtNetPingGraph;
