/**
 * Factory reset check — runs before React mount (see main.tsx).
 * Clears storage when the server reports a pending factory reset.
 *
 * Reload-loop guard: the post-reset reload re-enters this module with fresh
 * scope, so the module-level flag isn't enough on its own. We persist a
 * sessionStorage breadcrumb that survives the reload but dies with the tab,
 * so a second consecutive marker hit is treated as already-handled.
 */

import { clearFactoryResetBrowserStorage } from './factoryResetStorage'

const RELOAD_GUARD_KEY = '__ab_factory_reset_reloaded__'

let factoryResetChecked = false
let factoryResetPerformed = false

export async function checkFactoryReset(): Promise<boolean> {
  if (factoryResetChecked) {
    return factoryResetPerformed
  }

  try {
    const alreadyReloaded =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(RELOAD_GUARD_KEY) === '1'

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

    if (data.factoryReset && !alreadyReloaded) {
      clearFactoryResetBrowserStorage()
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
      factoryResetPerformed = true
    } else if (alreadyReloaded) {
      // Second pass after the post-reset reload — clear the breadcrumb so a
      // future, user-initiated reset in the same tab still works.
      sessionStorage.removeItem(RELOAD_GUARD_KEY)
    }
  } catch (error) {
    console.warn('Factory reset check failed (non-critical):', error)
  } finally {
    factoryResetChecked = true
  }

  return factoryResetPerformed
}
