import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadPersistedState, defaultPersistedState, setStorageAdapter } from './utils/storage';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root is missing from index.html');
}

/**
 * Picks the backend for this build. The import is dynamic so the Tauri adapter
 * and its IPC layer stay out of the web bundle entirely.
 */
async function selectStorageAdapter(): Promise<void> {
  if (!isTauri()) return; // the browser build keeps the localStorage default

  const { tauriAdapter } = await import('./utils/storage/tauriAdapter');
  setStorageAdapter(tauriAdapter);
}

// Storage is read once, before the first render, so the app itself stays
// synchronous: no loading state threaded through every component, and no flash
// of default settings before the stored ones arrive. A backend that cannot be
// read at all still has to produce a usable app, hence the fallback — the
// ErrorBoundary only covers failures that happen once React is mounted.
selectStorageAdapter()
  .then(loadPersistedState)
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
