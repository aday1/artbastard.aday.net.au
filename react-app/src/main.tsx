import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ErrorBoundaryWithRetry } from './components/ErrorBoundaryWithRetry'
import { checkFactoryReset } from './utils/factoryResetCheck'
import './styles/index.scss'

async function bootstrap() {
  const didReset = await checkFactoryReset()
  if (didReset) {
    window.location.reload()
    return
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundaryWithRetry
        maxRetries={3}
        retryDelay={1000}
        onError={(error, errorInfo) => {
          if (typeof window !== 'undefined' && (window as any).monitoringService) {
            (window as any).monitoringService.recordError({
              message: error.message,
              stack: error.stack,
              component: 'App',
              severity: 'critical',
            })
          }
          console.error('Application error:', error, errorInfo)
        }}
      >
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ErrorBoundaryWithRetry>
    </React.StrictMode>
  )
}

bootstrap()
