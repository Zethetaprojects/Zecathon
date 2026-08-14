import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="glass-panel max-w-lg w-full p-8 text-center">
              <h2 className="font-pixel text-lg text-neon-pink mb-4">SYSTEM FAILURE</h2>
              <p className="text-slate-300 mb-4 text-sm">
                Something crashed in the ZECATHON interface. The error has been logged to the console.
              </p>
              {this.state.error && (
                <pre className="text-left text-xs text-slate-400 bg-black/30 rounded p-3 mb-6 overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded neon-btn neon-btn-cyan text-sm"
              >
                Reboot
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
