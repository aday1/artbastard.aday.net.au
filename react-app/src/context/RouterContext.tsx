import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { shouldDefaultToMobileSurface } from '../utils/deviceSurface'

export type ViewType = 'fixture' | 'planner' | 'scenesActs' | 'misc' | 'state' | 'dmxControl' | 'mobile'

interface RouterContextType {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  navigationHistory: ViewType[]
  goBack: () => void
  canGoBack: boolean
}

const RouterContext = createContext<RouterContextType | undefined>(undefined)

interface RouterProviderProps {
  children: ReactNode
}

const viewToHash: Record<ViewType, string> = {
  fixture: '#/fixture',
  planner: '#/planner',
  scenesActs: '#/scenes-acts',
  misc: '#/settings',
  state: '#/state',
  dmxControl: '#/dmx-control',
  mobile: '#/mobile'
}

const hashToView = (hashValue: string): ViewType | null => {
  const normalized = hashValue.replace(/^#/, '').replace(/^\//, '').toLowerCase()
  const pathOnly = normalized.split('?')[0]

  if (!pathOnly) return null

  switch (pathOnly) {
    case 'main':
    case 'external-console':
      return 'dmxControl'
    case 'fixture':
      return 'fixture'
    case 'planner':
      return 'planner'
    case 'scenes-acts':
    case 'scenesacts':
    case 'acts':
    case 'scenes':
      return 'scenesActs'
    case 'settings':
    case 'misc':
      return 'misc'
    case 'state':
      return 'state'
    case 'dmx-control':
    case 'dmxcontrol':
      return 'dmxControl'
    case 'experimental':
      return 'dmxControl'
    case 'mobile':
      return 'mobile'
    default:
      return null
  }
}

/**
 * Pick a sensible default view when the URL has no hash. Phones and
 * actual touch tablets default to the dedicated touch surface. The
 * refreshed ArtBastard hosts open on the newer fixture workbench so
 * the retired live DMX wall does not come back after promotion.
 */
const resolveDefaultView = (): ViewType => {
  if (typeof window === 'undefined') return 'fixture'
  try {
    if (shouldDefaultToMobileSurface()) return 'mobile'
    return 'fixture'
  } catch {
    return 'fixture'
  }
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const initialHashView = hashToView(window.location.hash)
  const initialView: ViewType = initialHashView || resolveDefaultView()
  const [currentView, setCurrentView] = useState<ViewType>(initialView)
  const [navigationHistory, setNavigationHistory] = useState<ViewType[]>([initialView])

  useEffect(() => {
    const legacy = hashToView(window.location.hash)
    if (legacy === 'dmxControl' && window.location.hash.match(/main|external-console/i)) {
      window.history.replaceState(null, '', viewToHash.dmxControl)
    }
  }, [])

  useEffect(() => {
    const handleViewChange = (event: CustomEvent<{ view: ViewType }>) => {
      const newView = event.detail.view
      setCurrentView(newView)
      setNavigationHistory(prev => [...prev, newView])
    }

    window.addEventListener('changeView', handleViewChange as EventListener)
    return () => {
      window.removeEventListener('changeView', handleViewChange as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleHashRouteChange = () => {
      const routeView = hashToView(window.location.hash)
      if (!routeView || routeView === currentView) return

      setCurrentView(routeView)
      setNavigationHistory(prev => [...prev, routeView])
    }

    window.addEventListener('hashchange', handleHashRouteChange)
    return () => {
      window.removeEventListener('hashchange', handleHashRouteChange)
    }
  }, [currentView])

  useEffect(() => {
    const targetHash = viewToHash[currentView]
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash)
    }
  }, [currentView])

  const handleSetCurrentView = (view: ViewType) => {
    setCurrentView(view)
    setNavigationHistory(prev => [...prev, view])
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('router:view-change', { detail: { view } }))
    }
  }

  const goBack = () => {
    if (navigationHistory.length > 1) {
      const newHistory = navigationHistory.slice(0, -1)
      const previousView = newHistory[newHistory.length - 1]
      setNavigationHistory(newHistory)
      setCurrentView(previousView)
    }
  }

  const canGoBack = navigationHistory.length > 1

  return (
    <RouterContext.Provider
      value={{
        currentView,
        setCurrentView: handleSetCurrentView,
        navigationHistory,
        goBack,
        canGoBack
      }}
    >
      {children}
    </RouterContext.Provider>
  )
}

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider')
  }
  return context
}

