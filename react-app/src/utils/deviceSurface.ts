export const PHONE_BP = 640
export const TABLET_BP = 1280

const BETA_HOSTS = new Set([
  'artbastard-dev.aday.net.au',
  'artbastard-beta.aday.net.au',
])

const canUseWindow = (): boolean => typeof window !== 'undefined'

const matchesMedia = (query: string): boolean => {
  if (!canUseWindow()) return false
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

export const isBetaLaneHost = (): boolean => {
  if (!canUseWindow()) return false
  return BETA_HOSTS.has(window.location.hostname.toLowerCase())
}

export const hasTouchInput = (): boolean => {
  if (!canUseWindow()) return false
  const nav = window.navigator as Navigator & { msMaxTouchPoints?: number }
  return (
    'ontouchstart' in window ||
    matchesMedia('(pointer: coarse)') ||
    nav.maxTouchPoints > 0 ||
    (nav.msMaxTouchPoints ?? 0) > 0
  )
}

export const isPhoneViewport = (): boolean => matchesMedia(`(max-width: ${PHONE_BP - 1}px)`)

export const isTabletViewport = (): boolean =>
  matchesMedia(`(min-width: ${PHONE_BP}px) and (max-width: ${TABLET_BP - 1}px)`)

export const shouldDefaultToMobileSurface = (): boolean =>
  isPhoneViewport() || (isTabletViewport() && hasTouchInput())

export const shouldDefaultToBetaWorkbench = (): boolean =>
  isBetaLaneHost() && !shouldDefaultToMobileSurface()

export const shouldUseTouchOptimizedChrome = (): boolean =>
  isPhoneViewport() || hasTouchInput()
