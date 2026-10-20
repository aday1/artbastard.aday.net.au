import { useEffect, useState, MouseEvent } from 'react'
import { toast } from 'react-toastify'

/** Local Kefka uses persistent app windows; other clients use the link's target. */
export function useKefkaSurface(surface: 'deck' | 'console') {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) return
    const controller = new AbortController()
    fetch('/api/kefka/surfaces', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : { enabled: false })
      .then(result => { if (!controller.signal.aborted) setAvailable(result.enabled === true) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!available || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    fetch(`/api/kefka/surfaces/${surface}`, { method: 'POST' })
      .then(response => { if (!response.ok) throw new Error('Launch failed') })
      .catch(() => toast.error('Could not open Deck Controls. Try the ArtBastard Deck launcher.'))
  }
}
