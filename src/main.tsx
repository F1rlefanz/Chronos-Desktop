import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadPersistedState, defaultPersistedState, setStorageAdapter } from './utils/storage';
import { logError, logInfo, setLogSink } from './utils/logging/logger';
import { setFileSink } from './utils/fileTarget';
import { setSyncTransport } from './utils/sync';
import { isMobilePlatform } from './utils/platform';
import { androidBackupSupport, androidFileSink, setAndroidFilesFolder } from './utils/androidFiles';
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

  // Two backends for one set of interfaces, and the difference is the
  // platform's, not ours: a desktop hands out a path and writes through a
  // rename; Android hands out a permission on a document tree and everything
  // goes through a content provider. Neither `runSync` nor `deliverFile` nor
  // `ensureDailyBackup` ever learns which one it got — this is the only place
  // that knows, which is the rule the storage adapter has always followed.
  if (isMobilePlatform()) {
    // `androidFiles` is imported statically rather than here: `App.tsx` needs
    // it during render anyway, so a dynamic import cannot move it into a chunk
    // of its own and the bundler says as much.
    const { androidSyncTransport } = await import('./utils/sync/androidSyncTransport');

    setSyncTransport(androidSyncTransport);
    // Both wrap the app-private originals rather than replacing them: with no
    // folder chosen the phone behaves exactly as it did before.
    setFileSink(androidFileSink(tauriFileSink));
    setStorageAdapter({
      ...tauriAdapter,
      backups: tauriAdapter.backups && androidBackupSupport(tauriAdapter.backups),
    });
  } else {
    const { tauriSyncTransport } = await import('./utils/sync/tauriSyncTransport');

    setSyncTransport(tauriSyncTransport);
    setStorageAdapter(tauriAdapter);
    // Without this the export buttons do nothing at all: the WebView ignores
    // the `<a download>` click the browser build relies on.
    setFileSink(tauriFileSink);
  }
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
    // Before the first render, not in an effect: the daily snapshot is taken as
    // soon as the app mounts, and a folder installed a moment later would send
    // the first backup of the day to the app-private fallback instead.
    if (isMobilePlatform() && initialState.settings.deviceFilesFolder) {
      setAndroidFilesFolder(initialState.settings.deviceFilesFolder);
    }

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
