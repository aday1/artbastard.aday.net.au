import React, { createContext, useContext, useEffect } from 'react'
import { useStore } from '../store'

export type Theme = 'artsnob' | 'standard' | 'minimal'

export interface ThemeContextType {
  theme: Theme
  darkMode: boolean
  setTheme: (theme: Theme) => void
  toggleDarkMode: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'artsnob',
  darkMode: true,
  setTheme: () => {},
  toggleDarkMode: () => {}
})

export const useTheme = (): ThemeContextType => useContext(ThemeContext)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, darkMode, setTheme, toggleDarkMode } = useStore(state => ({
    theme: state.theme,
    darkMode: state.darkMode,
    setTheme: state.setTheme,
    toggleDarkMode: state.toggleDarkMode
  }))

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const savedDarkMode = localStorage.getItem('darkMode')
    
    if (savedTheme) {
      setTheme(savedTheme)
    }
    
    if (savedDarkMode !== null) {
      if (savedDarkMode === 'true' !== darkMode) {
        toggleDarkMode()
      }
    } else {
      // Default to dark mode if not specified
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    
    // Add theme class to body
    document.body.className = theme
  }, [])

  useEffect(() => {
    // Update body class when theme changes
    document.body.className = theme
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, darkMode, setTheme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}