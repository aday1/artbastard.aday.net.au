export interface PathPoint {
  x: number;
  y: number;
  timestamp?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function perpendicularDistance(point: PathPoint, start: PathPoint, end: PathPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

/** Ramer-Douglas-Peucker: keep only points needed to preserve shape within tolerance. */
export function simplifyPath(points: PathPoint[], tolerance = 3): PathPoint[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, index + 1), tolerance);
    const right = simplifyPath(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

export function smoothUserPath(points: PathPoint[], amount = 1): PathPoint[] {
  if (points.length < 2) return points;
  const strength = clamp01(amount);
  if (strength <= 0) return points;
  const smoothed: PathPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1] || points[i];
    const p3 = points[i + 2] || points[i + 1] || points[i];
    for (let t = 0; t <= 1; t += 0.25) {
      const t2 = t * t;
      const t3 = t2 * t;
      const curveX =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const curveY =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const linearX = p1.x + (p2.x - p1.x) * t;
      const linearY = p1.y + (p2.y - p1.y) * t;
      const x = linearX + (curveX - linearX) * strength;
      const y = linearY + (curveY - linearY) * strength;
      smoothed.push({ x, y });
    }
  }
  smoothed.push(points[points.length - 1]);
  return simplifyPath(smoothed, Math.max(2, toleranceForCount(points.length)));
}

function toleranceForCount(count: number): number {
  if (count > 200) return 5;
  if (count > 80) return 4;
  return 3;
}

export function interpolatePath(points: PathPoint[]): PathPoint[] {
  const interpolated: PathPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    interpolated.push(current);
    const steps = 4;
    for (let j = 1; j < steps; j++) {
      const t = j / steps;
      interpolated.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      });
    }
  }
  if (points.length) interpolated.push(points[points.length - 1]);
  return interpolated;
}

export function buildShapePath(
  shape: 'circle' | 'triangle' | 'square' | 'star',
  centerX: number,
  centerY: number,
  size: number
): PathPoint[] {
  const path: PathPoint[] = [];
  const totalDuration = 2000;
  let currentTime = 0;

  if (shape === 'circle') {
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      path.push({
        x: centerX + size * Math.cos(angle),
        y: centerY + size * Math.sin(angle),
        timestamp: currentTime,
      });
      currentTime += totalDuration / segments;
    }
  } else if (shape === 'triangle') {
    const pts = [
      { x: centerX, y: centerY - size },
      { x: centerX - size, y: centerY + size },
      { x: centerX + size, y: centerY + size },
      { x: centerX, y: centerY - size },
    ];
    const seg = totalDuration / pts.length;
    pts.forEach((p) => {
      path.push({ ...p, timestamp: currentTime });
      currentTime += seg;
    });
  } else if (shape === 'square') {
    const pts = [
      { x: centerX - size, y: centerY - size },
      { x: centerX + size, y: centerY - size },
      { x: centerX + size, y: centerY + size },
      { x: centerX - size, y: centerY + size },
      { x: centerX - size, y: centerY - size },
    ];
    const seg = totalDuration / pts.length;
    pts.forEach((p) => {
      path.push({ ...p, timestamp: currentTime });
      currentTime += seg;
    });
  } else {
    const points = 5;
    const step = Math.PI / points;
    for (let i = 0; i < 2 * points; i++) {
      const angle = i * step;
      const r = i % 2 === 0 ? size : size / 2;
      path.push({
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        timestamp: currentTime,
      });
      currentTime += totalDuration / (2 * points);
    }
    if (path.length) path.push({ ...path[0], timestamp: currentTime });
  }
  return path;
}

export function pathToDmxPoints(
  path: PathPoint[],
  padWidth: number,
  padHeight: number,
  smoothing = 0
): { x: number; y: number }[] {
  if (path.length === 0) return [];
  const toDmx = (p: PathPoint) => ({
    x: Math.round(Math.max(0, Math.min(255, (p.x / padWidth) * 255))),
    y: Math.round(Math.max(0, Math.min(255, (1 - p.y / padHeight) * 255))),
  });
  let dmxPoints: PathPoint[] = path.map(toDmx);
  dmxPoints = simplifyPath(dmxPoints, 4);
  if (smoothing > 0 && dmxPoints.length >= 3) {
    const curved = smoothUserPath(dmxPoints, smoothing);
    dmxPoints = simplifyPath(curved, 4);
  }
  return dmxPoints.map((p) => ({ x: p.x, y: p.y }));
}

export function dmxToPadPercent(pan: number, tilt: number): { x: number; y: number } {
  return {
    x: (pan / 255) * 100,
    y: (1 - tilt / 255) * 100,
  };
}

export function dmxPathToPadPath(
  points: Array<{ x: number; y: number }>,
  padWidth: number,
  padHeight: number
): PathPoint[] {
  return points.map((p) => ({
    x: (p.x / 255) * padWidth,
    y: (1 - p.y / 255) * padHeight,
    timestamp: 0,
  }));
}
