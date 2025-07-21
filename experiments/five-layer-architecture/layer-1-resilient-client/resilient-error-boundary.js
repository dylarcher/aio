// React Error Boundary with recovery strategies
export class ResilientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
      retryCount: this.state.retryCount + 1,
    });

    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  reportError(error, errorInfo) {
    // Send to error tracking service
    if (window.gtag) {
      gtag('event', 'exception', {
        description: error.toString(),
        fatal: false,
        custom_map: {
          component_stack: errorInfo.componentStack,
        },
      });
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < 3;

      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're working to fix this issue.</p>

          {canRetry && (
            <button
              className="retry-button"
              onClick={this.handleRetry}
              type="button"
            >
              Try Again ({3 - this.state.retryCount} attempts left)
            </button>
          )}

          {!canRetry && (
            <button onClick={() => window.location.reload()} type="button">
              Reload Page
            </button>
          )}

          {process.env.NODE_ENV === 'development' && (
            <details>
              <summary>Error Details (Development)</summary>
              <pre>{this.state.error && this.state.error.toString()}</pre>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
