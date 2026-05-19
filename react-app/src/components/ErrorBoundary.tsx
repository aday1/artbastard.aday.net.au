import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error('React Error Boundary caught an error:', error, errorInfo);
    
    // Update state with full error information
    this.setState({
      hasError: true,
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ff4444',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          fontFamily: 'monospace',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <h2 style={{ color: '#cc0000', marginTop: 0 }}>
            🚨 React Application Error
          </h2>
          
          <div style={{ marginBottom: '15px' }}>
            <h3 style={{ color: '#aa0000' }}>Error Message:</h3>
            <div style={{
              padding: '10px',
              backgroundColor: '#ffeeee',
              border: '1px solid #ffaaaa',
              borderRadius: '4px',
              fontWeight: 'bold',
              color: '#cc0000'
            }}>
              {this.state.error?.message || 'Unknown error occurred'}
            </div>
          </div>

          {this.state.error?.stack && (
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ color: '#aa0000' }}>Stack Trace:</h3>
              <pre style={{
                padding: '10px',
                backgroundColor: '#f8f8f8',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.error.stack}
              </pre>
            </div>
          )}

          {this.state.errorInfo?.componentStack && (
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ color: '#aa0000' }}>Component Stack:</h3>
              <pre style={{
                padding: '10px',
                backgroundColor: '#f8f8f8',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              🔄 Reload Page
            </button>
            
            <button
              onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔧 Try Again
            </button>
          </div>

          <div style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#e6f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            <strong>💡 Debug Tips:</strong>
            <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
              <li>Check the browser's Developer Console (F12) for additional errors</li>
              <li>Look for network errors in the Network tab</li>
              <li>Verify the backend server is running on port 3030</li>
              <li>Check if all required dependencies are installed</li>
            </ul>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
