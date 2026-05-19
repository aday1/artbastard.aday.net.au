import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ErrorBoundaryWithRetry } from './components/ErrorBoundaryWithRetry'
import './styles/index.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundaryWithRetry
      maxRetries={3}
      retryDelay={1000}
      onError={(error, errorInfo) => {
        // Log to monitoring service if available
        if (typeof window !== 'undefined' && (window as any).monitoringService) {
          (window as any).monitoringService.recordError({
            message: error.message,
            stack: error.stack,
            component: 'App',
            severity: 'critical'
          });
        }
        console.error('Application error:', error, errorInfo);
      }}
    >
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ErrorBoundaryWithRetry>
  </React.StrictMode>
)