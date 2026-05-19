export interface PathPoint {
  x: number;
  y: number;
  timestamp?: number;
}

export function smoothUserPath(points: PathPoint[]): PathPoint[] {
  if (points.length < 2) return points;
  const smoothed: PathPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1] || points[i];
    const p3 = points[i + 2] || points[i + 1] || points[i];
    for (let t = 0; t <= 1; t += 0.1) {
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      smoothed.push({ x, y });
    }
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

export function interpolatePath(points: PathPoint[]): PathPoint[] {
  const interpolated: PathPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    interpolated.push(current);
    const steps = 10;
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
    const segments = 100;
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
  padHeight: number
): { x: number; y: number }[] {
  return path.map((p) => ({
    x: Math.round(Math.max(0, Math.min(255, (p.x / padWidth) * 255))),
    y: Math.round(Math.max(0, Math.min(255, (1 - p.y / padHeight) * 255))),
  }));
}

export function dmxToPadPercent(pan: number, tilt: number): { x: number; y: number } {
  return {
    x: (pan / 255) * 100,
    y: (1 - tilt / 255) * 100,
  };
}
