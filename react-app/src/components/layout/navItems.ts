import type { ViewType } from '../../context/RouterContext'

export interface NavItem {
  id: ViewType
  /** Lucide icon name. */
  icon: string
  title: {
    artsnob: string
    standard: string
    minimal: string
    /** Long-form helper shown as a tooltip / secondary line. */
    tooltip?: string
  }
  /**
   * Hint to consumers about how this item should be opened.
   * - `popup` = Mobile on desktop may open a separate window; mobile chrome
   *   navigates in-place because popups are blocked on iOS.
   * - `route` = standard in-app route.
   */
  launch?: 'popup' | 'route'
}

/**
 * Single source of truth for the primary navigation items shared by
 * the desktop floating top nav and the mobile top-bar / drawers.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dmxControl',
    icon: 'Zap',
    launch: 'route',
    title: {
      artsnob: 'Contrôle DMX Ultime',
      standard: 'DMX Control',
      minimal: 'DMX',
      tooltip: 'Direct DMX channel control with MIDI Learn/Forget functionality.',
    },
  },
  {
    id: 'fixture',
    icon: 'LampDesk',
    launch: 'route',
    title: {
      artsnob: 'Fixture Extraordinaire',
      standard: 'Fixtures',
      minimal: 'Fix',
      tooltip: 'Define and control your light fixtures.',
    },
  },
  {
    id: 'scenesActs',
    icon: 'Theater',
    launch: 'route',
    title: {
      artsnob: 'Scènes Dramatiques',
      standard: 'Scenes',
      minimal: 'Scenes',
      tooltip: 'Capture lighting scenes and scene timelines.',
    },
  },
  {
    id: 'acts',
    icon: 'Clapperboard',
    launch: 'route',
    title: {
      artsnob: 'Actes Dramatiques',
      standard: 'Acts',
      minimal: 'Acts',
      tooltip: 'Arrange scenes into touch-friendly act timelines and ACT triggers.',
    },
  },
  {
    id: 'mobile',
    icon: 'Smartphone',
    launch: 'popup',
    title: {
      artsnob: 'Surface Tactile',
      standard: 'Touch Surface',
      minimal: 'Touch',
      tooltip:
        'Same Super Control and DMX channel pages as desktop, with a touch-first layout on phones and tablets.',
    },
  },
  {
    id: 'misc',
    icon: 'Settings',
    launch: 'route',
    title: {
      artsnob: 'Paramètres Cognoscenti',
      standard: 'Settings',
      minimal: 'Cfg',
      tooltip: 'Configuration and preferences.',
    },
  },
]

/** Resolve a localised label for an item given the current theme. */
export const itemLabel = (
  item: NavItem,
  theme: 'artsnob' | 'standard' | 'minimal' | string
): string => {
  if (theme === 'artsnob') return item.title.artsnob
  if (theme === 'minimal') return item.title.minimal
  return item.title.standard
}
