import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadPersistedState, defaultPersistedState, setStorageAdapter } from './utils/storage';
import { logError, logInfo, setLogSink } from './utils/logging/logger';
import { setFileSink } from './utils/fileTarget';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root is missing from index.html');
}

/**
 * Picks the backend for this build, and the place log lines go with it.
 *
 * Both imports are dynamic, so neither the Tauri adapter nor the IPC layer ends
 * up in the web bundle. The log sink is installed first: everything after this
 * point is worth having on disk when something goes wrong at startup.
 */
async function selectBackend(): Promise<void> {
  if (!isTauri()) return; // the browser build logs to a console someone can open

  const [{ tauriLogSink }, { tauriAdapter }, { tauriFileSink }] = await Promise.all([
    import('./utils/logging/tauriLogSink'),
    import('./utils/storage/tauriAdapter'),
    import('./utils/tauriFileSink'),
  ]);

  setLogSink(tauriLogSink);
  setStorageAdapter(tauriAdapter);
  // Without this the export buttons do nothing at all: the WebView ignores the
  // `<a download>` click the browser build relies on.
  setFileSink(tauriFileSink);
}

// Unhandled failures are the ones nobody thought to log, which makes them
// exactly the ones worth having in the file.
window.addEventListener('error', (event) => {
  logError('[Window] Uncaught error:', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  logError('[Window] Unhandled promise rejection:', event.reason);
});

// Storage is read once, before the first render, so the app itself stays
// synchronous: no loading state threaded through every component, and no flash
// of default settings before the stored ones arrive. A backend that cannot be
// read at all still has to produce a usable app, hence the fallback — the
// ErrorBoundary only covers failures that happen once React is mounted.
selectBackend()
  .then(loadPersistedState)
  .catch((error: unknown) => {
    logError('[Storage] Could not load persisted state, starting from defaults:', error);
    return defaultPersistedState();
  })
  .then((initialState) => {
    // The first line of every run: which build, and how much it found. Reading
    // a log starts with knowing what was running.
    logInfo(
      `[App] Chronos Desktop ${__APP_VERSION__} started —`,
      `${initialState.entries.length} sessions, ${initialState.projects.length} projects`
    );

    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App initialState={initialState} />
        </ErrorBoundary>
      </StrictMode>
    );
  });
