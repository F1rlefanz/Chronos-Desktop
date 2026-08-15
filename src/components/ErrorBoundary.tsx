import { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '../utils/logging/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so a single bad component cannot leave a blank page.
 *
 * This has to be a class: React exposes no hook equivalent of
 * `getDerivedStateFromError`. The fallback deliberately says that the saved
 * data is untouched — every entry lives in localStorage, not in the component
 * tree, so a reload recovers the app with the history intact.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError('[ErrorBoundary] Uncaught render error:', error, errorInfo.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen bg-[#F4F7F9] text-[#1A1C1E] font-sans antialiased flex items-center justify-center px-4"
      >
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-6 space-y-4">
          <h1 className="text-lg font-semibold">Beim Anzeigen ist etwas schiefgegangen</h1>

          <p className="text-sm text-gray-600">
            Die gespeicherten Einträge liegen getrennt davon und sind nicht betroffen. Ein Neuladen
            sollte die App zurückbringen.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#2D5BFF] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2449cc] focus:outline-none focus:ring-2 focus:ring-[#2D5BFF] focus:ring-offset-2"
          >
            App neu laden
          </button>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer select-none">Technische Details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[0.6875rem] text-gray-600">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
