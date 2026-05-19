/**
 * Factory reset check — runs before React mount (see main.tsx).
 * Clears storage when the server reports a pending factory reset.
 */

let factoryResetChecked = false
let factoryResetPerformed = false

export async function checkFactoryReset(): Promise<boolean> {
  if (factoryResetChecked) {
    return factoryResetPerformed
  }

  try {
    const response = await fetch('/api/factory-reset-check', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })

    if (!response.ok) {
      factoryResetChecked = true
      return false
    }

    const data = await response.json()

    if (data.factoryReset) {
      localStorage.clear()
      sessionStorage.clear()
      factoryResetPerformed = true
    }
  } catch (error) {
    console.warn('Factory reset check failed (non-critical):', error)
  } finally {
    factoryResetChecked = true
  }

  return factoryResetPerformed
}
