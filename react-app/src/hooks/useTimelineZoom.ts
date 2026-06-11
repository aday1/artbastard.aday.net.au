import { useState, useCallback, useEffect } from 'react';

interface UseTimelineZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  defaultZoom?: number;
  zoomStep?: number;
}

export function useTimelineZoom(options: UseTimelineZoomOptions = {}) {
  const {
    minZoom = 10,
    maxZoom = 500,
    defaultZoom = 30,
    zoomStep = 0.1
  } = options;

  const [zoom, setZoom] = useState(defaultZoom);
  const [horizontalScroll, setHorizontalScroll] = useState(0);
  const [verticalScroll, setVerticalScroll] = useState(0);

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * (1 + zoomStep), maxZoom));
  }, [maxZoom, zoomStep]);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev * (1 - zoomStep), minZoom));
  }, [minZoom, zoomStep]);

  const setZoomValue = useCallback((value: number) => {
    setZoom(Math.max(minZoom, Math.min(value, maxZoom)));
  }, [minZoom, maxZoom]);

  const resetZoom = useCallback(() => {
    setZoom(defaultZoom);
  }, [defaultZoom]);

  const handleWheel = useCallback((e: WheelEvent, container: HTMLElement) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + scroll
      e.preventDefault();
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
      setZoom(prev => {
        const newZoom = prev * (1 + delta);
        return Math.max(minZoom, Math.min(newZoom, maxZoom));
      });
    } else if (e.shiftKey) {
      // Horizontal scroll with Shift + scroll
      e.preventDefault();
      setHorizontalScroll(prev => prev - e.deltaY);
    } else {
      // Vertical scroll
      setVerticalScroll(prev => prev - e.deltaY);
    }
  }, [minZoom, maxZoom, zoomStep]);

  return {
    zoom,
    horizontalScroll,
    verticalScroll,
    zoomIn,
    zoomOut,
    setZoom: setZoomValue,
    resetZoom,
    setHorizontalScroll,
    setVerticalScroll,
    handleWheel
  };
}

