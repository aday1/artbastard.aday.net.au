// Reusable pointer-driven controls: faders and XY pad. No drag libraries, no jank.
import React, { useCallback, useRef } from 'react'

interface FaderProps {
  value: number            // 0-255
  onChange: (v: number) => void
  onDragState?: (dragging: boolean) => void
  horizontal?: boolean
  ariaLabel?: string
}

export const Fader = React.memo(function Fader({ value, onChange, onDragState, horizontal, ariaLabel }: FaderProps) {
  const ref = useRef<HTMLDivElement>(null)

  const valueFromEvent = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return value
    const rect = el.getBoundingClientRect()
    const frac = horizontal
      ? (e.clientX - rect.left) / rect.width
      : 1 - (e.clientY - rect.top) / rect.height
    return Math.max(0, Math.min(255, Math.round(frac * 255)))
  }, [horizontal, value])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ref.current?.setPointerCapture(e.pointerId)
    onDragState?.(true)
    onChange(valueFromEvent(e))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons & 1) onChange(valueFromEvent(e))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    try { ref.current?.releasePointerCapture(e.pointerId) } catch { /* ok */ }
    onDragState?.(false)
  }
  const onWheel = (e: React.WheelEvent) => {
    const step = e.shiftKey ? 1 : 5
    onChange(Math.max(0, Math.min(255, value + (e.deltaY < 0 ? step : -step))))
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(255, value + step)) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0, value - step)) }
    if (e.key === 'Home') { e.preventDefault(); onChange(255) }
    if (e.key === 'End') { e.preventDefault(); onChange(0) }
  }

  const frac = value / 255
  return (
    <div
      ref={ref}
      className={`${horizontal ? 'fader-h' : 'fader-v'}${value === 0 ? ' zero' : ''}`}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={255}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      {horizontal ? (
        <>
          <div className="fill" style={{ width: `${frac * 100}%` }} />
          <div className="thumb" style={{ left: `calc(${frac * 100}% - ${frac * 10}px)` }} />
        </>
      ) : (
        <>
          <div className="fill" style={{ height: `${frac * 100}%` }} />
          <div className="thumb" style={{ bottom: `calc(${frac * 100}% - ${frac * 10}px)` }} />
        </>
      )}
    </div>
  )
})

interface XYPadProps {
  x: number // 0-255
  y: number // 0-255
  onChange: (x: number, y: number) => void
}

export const XYPad = React.memo(function XYPad({ x, y, onChange }: XYPadProps) {
  const ref = useRef<HTMLDivElement>(null)

  const apply = (e: React.PointerEvent, fine: boolean) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    let ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    if (fine) {
      // fine mode: blend toward current position for precision
      nx = x / 255 + (nx - x / 255) * 0.15
      ny = (255 - y) / 255 + (ny - (255 - y) / 255) * 0.15
    }
    onChange(Math.round(nx * 255), Math.round((1 - ny) * 255))
  }

  return (
    <div
      ref={ref}
      className="xy-pad"
      onPointerDown={(e) => { e.preventDefault(); ref.current?.setPointerCapture(e.pointerId); apply(e, e.shiftKey) }}
      onPointerMove={(e) => { if (e.buttons & 1) apply(e, e.shiftKey) }}
    >
      <div className="grid-line" style={{ left: '50%', top: 0, bottom: 0, width: 1 }} />
      <div className="grid-line" style={{ top: '50%', left: 0, right: 0, height: 1 }} />
      <div className="dot" style={{ left: `${(x / 255) * 100}%`, top: `${(1 - y / 255) * 100}%` }} />
    </div>
  )
})

/** Click-to-edit numeric value (used under faders). */
export function EditableValue({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const handleClick = () => {
    const raw = window.prompt('Value (0-255)', String(value))
    if (raw === null) return
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) onChange(Math.max(0, Math.min(255, Math.round(parsed))))
  }
  return (
    <div className={className} onClick={handleClick} title="Click to type a value">
      {value}
    </div>
  )
}
