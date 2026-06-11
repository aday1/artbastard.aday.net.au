import React, { useEffect, useRef, useCallback } from 'react'
import styles from './Drawer.module.scss'

export type DrawerSide = 'left' | 'right' | 'bottom'

export interface DrawerProps {
  open: boolean
  side?: DrawerSide
  onClose: () => void
  ariaLabel: string
  children: React.ReactNode
  /**
   * Optional max width (left/right drawers) or max height (bottom).
   * Falls back to sensible defaults: 360px on tablets, 90vw on phones.
   */
  maxSize?: number | string
  /**
   * If true, the drawer mounts and animates above any other fixed
   * chrome. Default true.
   */
  elevated?: boolean
  /**
   * Optional extra class for the panel.
   */
  panelClassName?: string
}

const SWIPE_CLOSE_THRESHOLD = 60

/**
 * Generic off-canvas Drawer used for the mobile/tablet chrome.
 *
 * - Slides from the chosen side.
 * - Closes on backdrop tap, Escape, or swipe in the closing direction.
 * - Locks body scroll while open via the `ab-no-scroll` body class.
 * - Restores focus to the previously focused element on close.
 */
export const Drawer: React.FC<DrawerProps> = ({
  open,
  side = 'right',
  onClose,
  ariaLabel,
  children,
  maxSize,
  elevated = true,
  panelClassName,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const lastFocusRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Lock body scroll while open and restore focus on close.
  useEffect(() => {
    if (!open) return

    lastFocusRef.current = document.activeElement as HTMLElement | null
    document.body.classList.add('ab-no-scroll')

    // Defer focus to the panel so React has time to mount it.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable) {
        focusable.focus()
      } else {
        panel.focus()
      }
    }, 30)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.classList.remove('ab-no-scroll')
      // Restore focus only if the drawer still owned it.
      if (lastFocusRef.current && typeof lastFocusRef.current.focus === 'function') {
        try {
          lastFocusRef.current.focus()
        } catch {
          // Ignore - the previously focused node may be gone.
        }
      }
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleBackdropPointerDown = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Only close if the press started on the backdrop itself.
      if (event.target === event.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Swipe to close (touch only).
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    if (side === 'left' && dx < -SWIPE_CLOSE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      onClose()
    } else if (side === 'right' && dx > SWIPE_CLOSE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      onClose()
    } else if (side === 'bottom' && dy > SWIPE_CLOSE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      onClose()
    }
  }

  if (!open) return null

  const panelStyle: React.CSSProperties = {}
  if (maxSize !== undefined) {
    if (side === 'bottom') {
      panelStyle.maxHeight = typeof maxSize === 'number' ? `${maxSize}px` : maxSize
    } else {
      panelStyle.maxWidth = typeof maxSize === 'number' ? `${maxSize}px` : maxSize
    }
  }

  const sideClass =
    side === 'left' ? styles.left : side === 'right' ? styles.right : styles.bottom
  const elevationClass = elevated ? styles.elevated : ''
  const composedPanelClass = [styles.panel, sideClass, panelClassName, elevationClass]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={styles.backdrop}
      onMouseDown={handleBackdropPointerDown}
      onTouchStart={handleBackdropPointerDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={composedPanelClass}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

export default Drawer
