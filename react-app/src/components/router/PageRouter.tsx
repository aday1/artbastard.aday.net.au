import React, { Suspense, lazy } from 'react'
import { useRouter } from '../../context/RouterContext'
import DmxChannelControlPage from '../pages/DmxChannelControlPage'
import MobilePage from '../../pages/MobilePage'

const FixturePage = lazy(() => import('../../pages/FixturePage'))
const ActsScenesPage = lazy(() => import('../../pages/ActsScenesPage'))
const SettingsPage = lazy(() => import('../../pages/SettingsPage'))
const PageFallback = () => (
  <div style={{ padding: 24, opacity: 0.7 }}>Loading...</div>
)

const PageRouter: React.FC = () => {
  const { currentView } = useRouter()

  const renderCurrentPage = () => {
    switch (currentView) {
      case 'dmxControl':
        return <DmxChannelControlPage />
      case 'fixture':
        return (
          <Suspense fallback={<PageFallback />}>
            <FixturePage />
          </Suspense>
        )
      case 'scenesActs':
        return (
          <Suspense fallback={<PageFallback />}>
            <ActsScenesPage />
          </Suspense>
        )
      case 'misc':
        return (
          <Suspense fallback={<PageFallback />}>
            <SettingsPage />
          </Suspense>
        )
      case 'mobile':
        return <MobilePage />
      default:
        return <DmxChannelControlPage />
    }
  }

  return <>{renderCurrentPage()}</>
}

export default PageRouter
