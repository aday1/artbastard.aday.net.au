export interface PanTiltPathPoint {
  x: number;
  y: number;
}

export interface PanTiltPathSampleOptions {
  smoothing?: number;
  closed?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function cleanPath(points: PanTiltPathPoint[]): PanTiltPathPoint[] {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: clamp(point.x, 0, 255),
      y: clamp(point.y, 0, 255),
    }));
}

function pointAt(points: PanTiltPathPoint[], index: number, closed: boolean): PanTiltPathPoint {
  if (closed) {
    const wrapped = ((index % points.length) + points.length) % points.length;
    return points[wrapped];
  }
  return points[clamp(index, 0, points.length - 1)];
}

export function samplePanTiltPath(
  points: PanTiltPathPoint[],
  progress: number,
  options: PanTiltPathSampleOptions = {}
): PanTiltPathPoint | undefined {
  const path = cleanPath(points);
  if (path.length === 0) return undefined;
  if (path.length === 1) return path[0];

  const smoothing = clamp01(options.smoothing ?? 0);
  const closed = options.closed ?? true;
  const safeProgress = clamp01(progress);

  const segmentCount = closed ? path.length : path.length - 1;
  if (segmentCount <= 0) return path[0];

  if (!closed && safeProgress >= 1) return path[path.length - 1];

  const position = safeProgress * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(position));
  const local = position - index;
  const eased = lerp(local, smoothStep(local), smoothing);

  const p0 = pointAt(path, index - 1, closed);
  const p1 = pointAt(path, index, closed);
  const p2 = pointAt(path, index + 1, closed);
  const p3 = pointAt(path, index + 2, closed);

  const linearX = lerp(p1.x, p2.x, eased);
  const linearY = lerp(p1.y, p2.y, eased);
  const curveX = catmullRom(p0.x, p1.x, p2.x, p3.x, eased);
  const curveY = catmullRom(p0.y, p1.y, p2.y, p3.y, eased);

  return {
    x: clamp(lerp(linearX, curveX, smoothing), 0, 255),
    y: clamp(lerp(linearY, curveY, smoothing), 0, 255),
  };
}
