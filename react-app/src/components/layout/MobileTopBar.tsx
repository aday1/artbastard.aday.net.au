import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useRouter, ViewType } from '../../context/RouterContext'
import { useSocket } from '../../context/SocketContext'
import { useStore } from '../../store'
import * as Icons from 'lucide-react'
import { LucideIcon } from '../ui/LucideIcon'

type LucideIconName = keyof typeof Icons
import { Drawer } from '../ui/Drawer'
import { NAV_ITEMS, NavItem, itemLabel } from './navItems'
import { Navbar } from './Navbar'
import { PinnedChannels } from './PinnedChannels'
import { ThemeToggleButton } from './ThemeToggleButton'
import { ResetButton } from './ResetButton'
import { toast } from 'react-toastify'
import styles from './MobileTopBar.module.scss'

type DrawerKind = 'pinned' | 'nav' | 'pages' | null

interface MobileTopBarProps {
  leading?: React.ReactNode
}

/**
 * Compact responsive chrome that replaces the right sidebar Navbar and
 * left sidebar PinnedChannels at tablet and phone widths.
 *
 * Layout (left -> right):
 *   [hamburger -> pinned drawer]   [page title v -> pages sheet]
 *   [conn dot] [theme toggle] [more -> nav drawer]
 *
 * This component is rendered by Layout when useMobile().isMobileOrTablet
 * is true. It assumes Layout is wrapping it inside RouterProvider.
 */
export const MobileTopBar: React.FC<MobileTopBarProps> = ({ leading }) => {
  const { theme, darkMode, toggleDarkMode } = useTheme()
  const { currentView, setCurrentView } = useRouter()
  const { connected } = useSocket()
  const pinnedChannels = useStore((s) => s.pinnedChannels)

  const [drawer, setDrawer] = useState<DrawerKind>(null)

  const closeDrawer = useCallback(() => setDrawer(null), [])

  const visibleNavItems = useMemo(() => NAV_ITEMS, [])

  const currentNavItem = useMemo<NavItem | null>(
    () => visibleNavItems.find((item) => item.id === currentView) ?? null,
    [visibleNavItems, currentView]
  )

  // Close any open drawer when the current route changes (defence in
  // depth: each item handler also closes, but external state changes
  // such as keyboard shortcuts should also dismiss drawers).
  useEffect(() => {
    closeDrawer()
  }, [currentView, closeDrawer])

  const handleSelectView = (view: ViewType, launch?: 'popup' | 'route') => {
    closeDrawer()
    if (launch === 'popup' && view === 'mobile') {
      setCurrentView('mobile')
      return
    }
    setCurrentView(view)
  }

  const hasPinned = !!pinnedChannels && pinnedChannels.length > 0

  return (
    <>
      <header className={styles.topbar} role="banner">
        <div className={styles.left}>
          {leading}
          {hasPinned ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Open pinned channels"
              onClick={() => setDrawer('pinned')}
            >
              <LucideIcon name="PanelLeftOpen" size={22} />
            </button>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Pin channels (none yet)"
              onClick={() => {
                toast.info('Pin a channel from the DMX page to use this menu.')
                setCurrentView('dmxControl')
              }}
            >
              <LucideIcon name="Pin" size={20} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={styles.titleButton}
          aria-label="Switch page"
          onClick={() => setDrawer(drawer === 'pages' ? null : 'pages')}
        >
          <span className={styles.titleIcon} aria-hidden="true">
            <LucideIcon name={(currentNavItem?.icon ?? 'Zap') as LucideIconName} size={18} />
          </span>
          <span className={styles.titleLabel}>
            {currentNavItem ? itemLabel(currentNavItem, theme) : 'ArtBastard'}
          </span>
          <LucideIcon name="ChevronDown" size={16} />
        </button>

        <div className={styles.right}>
          <span
            className={`${styles.connDot} ${connected ? styles.connOk : styles.connBad}`}
            title={connected ? 'Connected to server' : 'Disconnected from server'}
            aria-label={connected ? 'Connected' : 'Disconnected'}
          />
          <button
            type="button"
            className={styles.iconButton}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleDarkMode}
          >
            <LucideIcon name={darkMode ? 'Sun' : 'Moon'} size={20} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open menu"
            onClick={() => setDrawer('nav')}
          >
            <LucideIcon name="Menu" size={22} />
          </button>
        </div>
      </header>

      {/* Pages sheet - quick page switcher */}
      <Drawer
        open={drawer === 'pages'}
        side="bottom"
        onClose={closeDrawer}
        ariaLabel="Switch page"
      >
        <div className={styles.sheetHeader}>
          <h2>Pages</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close"
            onClick={closeDrawer}
          >
            <LucideIcon name="X" size={20} />
          </button>
        </div>
        <ul className={styles.pagesList}>
          {visibleNavItems.map((item) => {
            const active = item.id === currentView
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.pageRow} ${active ? styles.pageRowActive : ''}`}
                  onClick={() => handleSelectView(item.id, item.launch)}
                >
                  <span className={styles.pageRowIcon} aria-hidden="true">
                    <LucideIcon name={item.icon as LucideIconName} size={20} />
                  </span>
                  <span className={styles.pageRowText}>
                    <span className={styles.pageRowTitle}>{itemLabel(item, theme)}</span>
                    {item.title.tooltip && (
                      <span className={styles.pageRowDesc}>{item.title.tooltip}</span>
                    )}
                  </span>
                  {active && <LucideIcon name="Check" size={18} />}
                </button>
              </li>
            )
          })}
        </ul>
      </Drawer>

      {/* Right drawer = Navbar in drawer variant + display controls */}
      <Drawer
        open={drawer === 'nav'}
        side="right"
        onClose={closeDrawer}
        ariaLabel="Main menu"
      >
        <div className={styles.sheetHeader}>
          <h2>Menu</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close"
            onClick={closeDrawer}
          >
            <LucideIcon name="X" size={20} />
          </button>
        </div>
        <div className={styles.drawerScroll}>
          <Navbar variant="drawer" onItemSelected={closeDrawer} />
          <div className={styles.drawerControls}>
            <ThemeToggleButton showLabels={true} />
            <ResetButton showLabels={true} />
          </div>
        </div>
      </Drawer>

      {/* Left drawer = PinnedChannels in drawer variant */}
      <Drawer
        open={drawer === 'pinned'}
        side="left"
        onClose={closeDrawer}
        ariaLabel="Pinned channels"
      >
        <div className={styles.sheetHeader}>
          <h2>Pinned channels</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close"
            onClick={closeDrawer}
          >
            <LucideIcon name="X" size={20} />
          </button>
        </div>
        <div className={styles.drawerScroll}>
          <PinnedChannels variant="drawer" />
        </div>
      </Drawer>
    </>
  )
}

export default MobileTopBar
