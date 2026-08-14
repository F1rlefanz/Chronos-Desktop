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
const saveTimeEntries = vi.fn<() => Promise<WriteResult>>(() => Promise.resolve(ok));
const writeBackup = vi.fn<(reason: string, contents: string, at?: Date) => Promise<WriteResult>>(
  () => Promise.resolve(ok)
);
const backupsAvailable = vi.fn(() => true);
const saveTombstones = vi.fn<(stones: { id: string; deletedAt: number }[]) => Promise<WriteResult>>(
  () => Promise.resolve(ok)
);

vi.mock('./utils/storage', async () => {
  const actual = await vi.importActual<typeof import('./utils/storage')>('./utils/storage');
  return {
    ...actual,
    saveSettings: (...args: Parameters<typeof actual.saveSettings>) => {
      void args;
      return saveSettings();
    },
    saveTimeEntries: (...args: Parameters<typeof actual.saveTimeEntries>) => {
      void args;
      return saveTimeEntries();
    },
    backupsAvailable: () => backupsAvailable(),
    saveTombstones: (...args: Parameters<typeof actual.saveTombstones>) => saveTombstones(...args),
    writeBackup: (...args: Parameters<typeof actual.writeBackup>) => writeBackup(...args),
    ensureDailyBackup: () => Promise.resolve(null),
  };
});

const initialState: PersistedState = {
  settings: DEFAULT_APP_SETTINGS,
  entries: [],
  projects: DEFAULT_PROJECTS,
  tombstones: [],
  deviceId: 'aabbccddeeff',
};

const withOneEntry: PersistedState = {
  ...initialState,
  entries: [
    {
      id: 'entry-1',
      title: 'Recorded Time Session',
      project: 'proj-work',
      tags: [],
      startTime: 1,
      endTime: 2,
      breaks: [],
      createdAt: 1,
      updatedAt: 1,
      source: 'stopwatch',
    },
  ],
};

function renderApp(state: PersistedState = initialState) {
  return render(<App initialState={state} />);
}

/** The header's audio toggle is the shortest path to a settings write. */
function toggleAudioCues() {
  return screen.getByTitle(/Signaltöne (an|aus)/);
}

describe('App persistence warnings', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings.mockResolvedValue(ok);
    saveTimeEntries.mockResolvedValue(ok);
    writeBackup.mockResolvedValue(ok);
    backupsAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('says nothing while writes succeed', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(toggleAudioCues());

    expect(screen.queryByText(/konnte nicht gespeichert werden/)).not.toBeInTheDocument();
  });

  it('warns when a write is rejected', async () => {
    const user = userEvent.setup();
    saveSettings.mockResolvedValue(rejected);
    renderApp();

    await user.click(toggleAudioCues());

    expect(
      await screen.findByText(/Einstellungen konnte nicht gespeichert werden/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Nach einem Neustart ist diese Änderung weg/)).toBeInTheDocument();
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
    expect(
      await screen.findByText(/Einstellungen konnte nicht gespeichert werden/)
    ).toBeInTheDocument();

    saveSettings.mockResolvedValue(ok);
    await user.click(toggleAudioCues());

    expect(
      screen.queryByText(/Einstellungen konnte nicht gespeichert werden/)
    ).not.toBeInTheDocument();
  });

  it('can be dismissed by the user', async () => {
    const user = userEvent.setup();
    saveSettings.mockResolvedValue(rejected);
    renderApp();

    await user.click(toggleAudioCues());
    await screen.findByText(/Einstellungen konnte nicht gespeichert werden/);
    await user.click(screen.getByRole('button', { name: 'Hinweis schließen' }));

    expect(
      screen.queryByText(/Einstellungen konnte nicht gespeichert werden/)
    ).not.toBeInTheDocument();
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

    expect(screen.queryByText(/konnte nicht gespeichert werden/)).not.toBeInTheDocument();
  });
});

describe('App backups before destructive actions', () => {
  beforeEach(() => {
    localStorage.clear();
    saveTimeEntries.mockResolvedValue(ok);
    writeBackup.mockResolvedValue(ok);
    backupsAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  async function clearHistory() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Alle löschen' }));
  }

  it('snapshots the history before clearing it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(withOneEntry);

    await clearHistory();

    expect(writeBackup).toHaveBeenCalledWith('before-clear', expect.stringContaining('entry-1'));
    expect(saveTimeEntries).toHaveBeenCalled();
  });

  it('takes the snapshot before the entries are gone, not after', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(withOneEntry);

    await clearHistory();

    // A snapshot of the already-cleared state would be worthless — the whole
    // point is the copy of what the user is about to lose.
    const [, payload] = writeBackup.mock.calls[0];
    expect(JSON.parse(payload).entries).toHaveLength(1);
  });

  it('asks before clearing when the snapshot could not be written', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    writeBackup.mockResolvedValue(rejected);
    renderApp(withOneEntry);

    await clearHistory();

    // Two dialogs: the existing "are you sure", then the warning that there is
    // no safety net this time.
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1][0]).toMatch(/Storage is full\./);
  });

  it('leaves the history alone when the user declines after a failed snapshot', async () => {
    vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(true) // yes, clear the history
      .mockReturnValueOnce(false); // no, not without a backup
    writeBackup.mockResolvedValue(rejected);
    renderApp(withOneEntry);

    await clearHistory();

    expect(saveTimeEntries).not.toHaveBeenCalled();
    expect(screen.getByText('Recorded Time Session')).toBeInTheDocument();
  });

  it('does not ask twice on a backend that keeps no snapshots', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    backupsAvailable.mockReturnValue(false);
    renderApp(withOneEntry);

    await clearHistory();

    expect(writeBackup).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(saveTimeEntries).toHaveBeenCalled();
  });
});

describe('App deletions leave a record', () => {
  beforeEach(() => {
    localStorage.clear();
    saveTimeEntries.mockResolvedValue(ok);
    saveTombstones.mockResolvedValue(ok);
    writeBackup.mockResolvedValue(ok);
    backupsAvailable.mockReturnValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // Dropping the entry is what the user asked for. The tombstone is what stops
  // another device from handing it straight back on the next merge, because
  // "deleted here" and "never seen here" look identical without one.
  it('records a tombstone when an entry is deleted', async () => {
    const user = userEvent.setup();
    renderApp(withOneEntry);

    await user.click(screen.getByTitle('Eintrag löschen'));

    expect(saveTombstones).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry-1' })]);
  });

  it('records one for every entry when the list is cleared', async () => {
    const user = userEvent.setup();
    renderApp(withOneEntry);

    await user.click(screen.getByRole('button', { name: 'Alle löschen' }));

    expect(saveTombstones).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry-1' })]);
  });
});

describe('App layout', () => {
  beforeEach(() => {
    localStorage.clear();
    backupsAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // The version used to sit in a fake title bar that repeated what Windows
  // draws itself. It moved to the footer rather than disappearing: it is the
  // first thing anyone is asked for when reporting a problem.
  it('shows the version in the footer', () => {
    renderApp();

    expect(screen.getByText(`Chronos Desktop v${__APP_VERSION__} • Zeiterfassung`)).toBeVisible();
  });

  it('no longer claims anything about the cloud', () => {
    renderApp();

    expect(screen.queryByText(/Cloud/i)).not.toBeInTheDocument();
  });

  it('starts on the recording view and keeps the analysis out of it', () => {
    renderApp(withOneEntry);

    expect(screen.getByRole('button', { name: /STARTEN/i })).toBeInTheDocument();
    expect(screen.queryByText('Letzte 12 Wochen')).not.toBeInTheDocument();
  });

  // The controls used to sit below the card, visually detached from the
  // readout they act on.
  it('keeps the timer controls inside the card that shows the time', () => {
    renderApp();

    expect(screen.getByRole('region', { name: 'Zeiterfassung' })).toContainElement(
      screen.getByRole('button', { name: /STARTEN/i })
    );
  });

  it('swaps the two halves over when the other tab is chosen', async () => {
    const user = userEvent.setup();
    renderApp(withOneEntry);

    await user.click(screen.getByRole('button', { name: 'Auswertung' }));

    expect(screen.getByText('Letzte 12 Wochen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /STARTEN/i })).not.toBeInTheDocument();
  });
});
