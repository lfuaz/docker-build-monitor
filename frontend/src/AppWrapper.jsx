import React, { Suspense } from 'react';
import { QueryClientProvider, QueryClient } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/ToastContainer';

// Create a new QueryClient instance directly here to avoid any import issues
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
      cacheTime: 5 * 60 * 1000,
    },
  },
});

// ErrorBoundary for catching React errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button onClick={() => window.location.reload()}>
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppWrapper() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <App />
            <ToastContainer />
          </Suspense>
          <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default AppWrapper;
