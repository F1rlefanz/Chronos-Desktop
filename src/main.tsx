import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadPersistedState, defaultPersistedState } from './utils/storage';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root is missing from index.html');
}

// Storage is read once, before the first render, so the app itself stays
// synchronous: no loading state threaded through every component, and no flash
// of default settings before the stored ones arrive. A backend that cannot be
// read at all still has to produce a usable app, hence the fallback — the
// ErrorBoundary only covers failures that happen once React is mounted.
loadPersistedState()
  .catch((error: unknown) => {
    console.error('[Storage] Could not load persisted state, starting from defaults:', error);
    return defaultPersistedState();
  })
  .then((initialState) => {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App initialState={initialState} />
        </ErrorBoundary>
      </StrictMode>
    );
  });
