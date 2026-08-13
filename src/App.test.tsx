import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { DEFAULT_APP_SETTINGS, DEFAULT_PROJECTS } from './constants/defaultConfig';
import type { PersistedState, WriteResult } from './utils/storage';

// The storage layer already turns write failures into a WriteResult; what is
// under test here is that App does something visible with a rejected one.
// Before this existed, a rejected write lost the data with no trace in the UI.
const ok: WriteResult = { ok: true };
const rejected: WriteResult = { ok: false, reason: 'quota', message: 'Storage is full.' };

const saveSettings = vi.fn<() => Promise<WriteResult>>(() => Promise.resolve(ok));

vi.mock('./utils/storage', async () => {
  const actual = await vi.importActual<typeof import('./utils/storage')>('./utils/storage');
  return {
    ...actual,
    saveSettings: (...args: Parameters<typeof actual.saveSettings>) => {
      void args;
      return saveSettings();
    },
  };
});

const initialState: PersistedState = {
  settings: DEFAULT_APP_SETTINGS,
  entries: [],
  projects: DEFAULT_PROJECTS,
};

function renderApp() {
  return render(<App initialState={initialState} />);
}

/** The header's audio toggle is the shortest path to a settings write. */
function toggleAudioCues() {
  return screen.getByTitle(/Audio cues (enabled|muted)/);
}

describe('App persistence warnings', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings.mockResolvedValue(ok);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('says nothing while writes succeed', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(toggleAudioCues());

    expect(screen.queryByText(/Could not save/)).not.toBeInTheDocument();
  });

  it('warns when a write is rejected', async () => {
    const user = userEvent.setup();
    saveSettings.mockResolvedValue(rejected);
    renderApp();

    await user.click(toggleAudioCues());

    expect(await screen.findByText(/Could not save your settings/)).toBeInTheDocument();
    expect(screen.getByText(/gone after a reload/)).toBeInTheDocument();
  });

  it('shows the reason the backend gave', async () => {
    const user = userEvent.setup();
    saveSettings.mockResolvedValue(rejected);
    renderApp();

    await user.click(toggleAudioCues());

    expect(await screen.findByText(/Storage is full\./)).toBeInTheDocument();
  });

  it('clears the warning once a write succeeds again', async () => {
    const user = userEvent.setup();
    saveSettings.mockResolvedValue(rejected);
    renderApp();

    await user.click(toggleAudioCues());
    expect(await screen.findByText(/Could not save your settings/)).toBeInTheDocument();

    saveSettings.mockResolvedValue(ok);
    await user.click(toggleAudioCues());

    expect(screen.queryByText(/Could not save your settings/)).not.toBeInTheDocument();
  });

  it('can be dismissed by the user', async () => {
    const user = userEvent.setup();
    saveSettings.mockResolvedValue(rejected);
    renderApp();

    await user.click(toggleAudioCues());
    await screen.findByText(/Could not save your settings/);
    await user.click(screen.getByRole('button', { name: 'Dismiss warning' }));

    expect(screen.queryByText(/Could not save your settings/)).not.toBeInTheDocument();
  });

  it('ignores a stale failure that resolves after a later write succeeded', async () => {
    const user = userEvent.setup();

    // The first write hangs; the second one succeeds while it is still in
    // flight. Writes were synchronous before storage went behind an adapter,
    // so this ordering could not happen — without the sequence check in
    // persist(), the late failure raises a banner for data that is saved.
    let failFirstWrite: () => void = () => {};
    saveSettings.mockImplementationOnce(
      () =>
        new Promise<WriteResult>((resolve) => {
          failFirstWrite = () => resolve(rejected);
        })
    );

    renderApp();

    await user.click(toggleAudioCues());
    await user.click(toggleAudioCues());

    // `act` flushes the resolution and any render it causes, so the assertion
    // below sees the banner the buggy version would have raised.
    await act(async () => {
      failFirstWrite();
    });

    expect(screen.queryByText(/Could not save/)).not.toBeInTheDocument();
  });
});
