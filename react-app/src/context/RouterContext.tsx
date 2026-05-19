import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ViewType = 'main' | 'fixture' | 'planner' | 'scenesActs' | 'misc' | 'state' | 'dmxControl' | 'experimental' | 'mobile'

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

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('dmxControl')
  const [navigationHistory, setNavigationHistory] = useState<ViewType[]>(['dmxControl'])

  // Listen for navigation events from navbar
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

  const handleSetCurrentView = (view: ViewType) => {
    setCurrentView(view)
    setNavigationHistory(prev => [...prev, view])
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
