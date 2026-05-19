import { describe, it, expect } from 'vitest'
import { CURRENT_VERSION, getVersionDisplay, getBuildInfo } from '../utils/version'

describe('Version Utils', () => {
  it('should have current version defined', () => {
    expect(CURRENT_VERSION).toBeDefined()
    expect(CURRENT_VERSION.version).toBe('5.12.0')
  })

  it('should format version display correctly', () => {
    const display = getVersionDisplay()
    expect(display).toMatch(/^v\d+\.\d+\.\d+/)
  })

  it('should include release type in non-stable versions', () => {
    const betaVersion = { ...CURRENT_VERSION, releaseType: 'beta' as const }
    const display = getVersionDisplay(betaVersion)
    expect(display).toContain('beta')
  })

  it('should generate build info', () => {
    const buildInfo = getBuildInfo()
    expect(buildInfo).toContain('Version')
    expect(buildInfo).toContain('5.12.0')
  })
})

