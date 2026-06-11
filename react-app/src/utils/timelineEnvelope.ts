import type { MouseEvent } from 'react';

/** Convert DMX 0-255 to SVG viewBox Y (0=top/full, 100=bottom/off). */
export function dmxValueToViewBoxY(value: number, max = 255): number {
  const clamped = Math.max(0, Math.min(max, value));
  return 100 - (clamped / max) * 100;
}

/** Convert SVG viewBox Y to DMX value. */
export function viewBoxYToDmxValue(viewBoxY: number, max = 255): number {
  const clamped = Math.max(0, Math.min(100, viewBoxY));
  return Math.round(max - (clamped / 100) * max);
}

export interface SvgTimelineCoords {
  svgXInTimeline: number;
  mouseYInViewBox: number;
  clickTime: number;
  rawDmxValue: number;
}

/** Map a mouse event on an envelope SVG to timeline time + DMX level. */
export function clientEventToEnvelopeCoords(
  event: MouseEvent<SVGSVGElement>,
  svg: SVGSVGElement,
  scrollPosition: number,
  pixelsToTime: (px: number) => number,
  effectiveDuration: number,
  trackHeight: number
): SvgTimelineCoords | null {
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = event.clientX;
  svgPoint.y = event.clientY;
  const svgCTM = svg.getScreenCTM();
  if (!svgCTM) return null;

  const svgCoords = svgPoint.matrixTransform(svgCTM.inverse());
  const svgXInTimeline = svgCoords.x + scrollPosition;
  const clickTime = Math.max(0, Math.min(pixelsToTime(svgXInTimeline), effectiveDuration));
  const mouseYInViewBox = svgCoords.y;
  const rawDmxValue = viewBoxYToDmxValue(mouseYInViewBox);

  return { svgXInTimeline, mouseYInViewBox, clickTime, rawDmxValue };
}

export function isNearKeyframe(
  keyframeTime: number,
  keyframeValue: number,
  svgXInTimeline: number,
  mouseYInViewBox: number,
  timeToPixels: (t: number) => number,
  trackHeight: number,
  hitPx = 10
): boolean {
  const kfX = timeToPixels(keyframeTime);
  const kfYInViewBox = dmxValueToViewBoxY(keyframeValue);
  const distX = Math.abs(kfX - svgXInTimeline);
  const distYPixels = (Math.abs(kfYInViewBox - mouseYInViewBox) / 100) * trackHeight;
  return distX < hitPx && distYPixels < hitPx;
}
