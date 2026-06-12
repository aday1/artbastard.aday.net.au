import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './HoverZoomImage.module.scss';

interface HoverZoomImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Pixel size of the popover preview (square). */
  zoomSize?: number;
  /** ms to wait before showing the popover. */
  hoverDelayMs?: number;
}

export const HoverZoomImage: React.FC<HoverZoomImageProps> = ({
  src,
  alt,
  className,
  imgClassName,
  zoomSize = 260,
  hoverDelayMs = 220,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);

  const cancelTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const positionPopover = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    let left = rect.right + margin;
    let top = rect.top + rect.height / 2 - zoomSize / 2;
    if (left + zoomSize > window.innerWidth - 8) left = rect.left - zoomSize - margin;
    if (left < 8) left = Math.max(8, rect.left);
    if (top + zoomSize > window.innerHeight - 8) top = window.innerHeight - zoomSize - 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [zoomSize]);

  const handleEnter = () => {
    cancelTimer();
    timerRef.current = window.setTimeout(() => {
      positionPopover();
      setOpen(true);
    }, hoverDelayMs);
  };

  const handleLeave = () => {
    cancelTimer();
    setOpen(false);
  };

  useEffect(() => cancelTimer, []);

  return (
    <span
      ref={wrapperRef}
      className={`${styles.wrapper} ${className ?? ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <img
        className={imgClassName}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {open && pos && (
        <span
          className={styles.popover}
          style={{ top: pos.top, left: pos.left, width: zoomSize, height: zoomSize }}
          aria-hidden
        >
          <img src={src} alt="" draggable={false} />
        </span>
      )}
    </span>
  );
};
