import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { DEFAULT_APP_SETTINGS, DEFAULT_PROJECTS } from './constants/defaultConfig';
import type { AppSettings, TimeEntry } from './types';
import type { PersistedState, WriteResult } from './utils/storage';

const ok: WriteResult = { ok: true };
const saveSettings = vi.fn<(settings: AppSettings) => Promise<WriteResult>>(() =>
  Promise.resolve(ok)
);
const saveTimeEntries = vi.fn<(entries: TimeEntry[]) => Promise<WriteResult>>(() =>
  Promise.resolve(ok)
);

vi.mock('./utils/storage', async () => {
  const actual = await vi.importActual<typeof import('./utils/storage')>('./utils/storage');
  return {
    ...actual,
    saveSettings: (settings: AppSettings) => saveSettings(settings),
    saveTimeEntries: (entries: TimeEntry[]) => saveTimeEntries(entries),
    backupsAvailable: () => false,
    ensureDailyBackup: () => Promise.resolve(null),
  };
});

const MINUTE = 60_000;

function state(settings: Partial<AppSettings> = {}, entries: TimeEntry[] = []): PersistedState {
  return {
    settings: { ...DEFAULT_APP_SETTINGS, soundEnabled: false, ...settings },
    entries,
    projects: DEFAULT_PROJECTS,
    tombstones: [],
    deviceId: 'aabbccddeeff',
    unreadable: [],
  };
}

/** A measurement that has been running for `minutes`, as one left over from before the app opened. */
function runningFor(minutes: number): TimeEntry {
  const startedAt = Date.now() - minutes * MINUTE;
  return {
    id: 'running-1',
    title: '',
    project: 'proj-work',
    tags: [],
    startTime: startedAt,
    endTime: null,
    breaks: [],
    createdAt: startedAt,
    updatedAt: startedAt,
    source: 'stopwatch',
  };
}

async function continueRecovered(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Weiterlaufen lassen/ }));
}

describe('The focus rhythm in the app', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('offers the flexible rhythm at 25 / 5 before anything has been chosen', () => {
    render(<App initialState={state()} />);

    expect(screen.getByRole('button', { name: 'Flexibel' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: '25 / 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('timer')).toHaveAccessibleName(/Erster Block: 25:00/);
  });

  it('writes a changed rhythm to the settings', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    await user.click(screen.getByRole('button', { name: 'Fest' }));
    await user.click(screen.getByRole('button', { name: '50 / 10' }));

    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ focusMode: 'fixed', focusMinutes: 50, breakMinutes: 10 })
    );
    expect(screen.getByRole('timer')).toHaveAccessibleName(/Erster Block: 50:00/);
  });

  it('keeps the stopwatch as it was in open mode: no ring and no block to choose', () => {
    render(<App initialState={state({ focusMode: 'open' })} />);

    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '25 / 5' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Offen' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks instead of acting when a flexible block reaches its target', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({}, [runningFor(26)])} />);
    await continueRecovered(user);

    const notice = await screen.findByRole('status');
    expect(within(notice).getByText(/Ziel erreicht: 25 Min\./)).toBeInTheDocument();
    // Asking must not have paused anything.
    expect(saveTimeEntries).not.toHaveBeenCalled();

    await user.click(within(notice).getByRole('button', { name: /Weiter im Fluss/ }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(saveTimeEntries).not.toHaveBeenCalled();
  });

  /**
   * The pause begins when the block ended, not when the app noticed. A block
   * that ran out while the window was closed must not count the gap as work.
   */
  it('starts the pause of a fixed block at the moment the block ended', async () => {
    const user = userEvent.setup();
    const entry = runningFor(40);
    render(<App initialState={state({ focusMode: 'fixed' }, [entry])} />);
    await continueRecovered(user);

    await vi.waitFor(() => expect(saveTimeEntries).toHaveBeenCalledTimes(1));
    const [saved] = saveTimeEntries.mock.calls[0][0];
    expect(saved.breaks).toHaveLength(1);
    expect(saved.breaks[0].startTime).toBe(entry.startTime + 25 * MINUTE);
    expect(saved.breaks[0].endTime).toBeNull();
    expect(screen.getByRole('timer')).toHaveAccessibleName(/^Pause:/);
  });

  it('does not pause an entry on its own while the recovery question is open', async () => {
    render(<App initialState={state({ focusMode: 'fixed' }, [runningFor(40)])} />);

    await screen.findByRole('button', { name: /Weiterlaufen lassen/ });
    expect(saveTimeEntries).not.toHaveBeenCalled();
  });

  it('offers the calm view as a button too, since a phone has no F key', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    await user.click(screen.getByRole('button', { name: 'Ruhe-Ansicht' }));
    await user.click(screen.getByRole('button', { name: 'Ruhe-Ansicht beenden' }));

    expect(screen.getByRole('button', { name: 'Ruhe-Ansicht' })).toBeInTheDocument();
  });

  it('swaps the card for the calm view on F and back on Escape', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    expect(screen.queryByRole('button', { name: 'Ruhe-Ansicht beenden' })).not.toBeInTheDocument();

    await user.keyboard('f');
    expect(screen.getByRole('button', { name: 'Ruhe-Ansicht beenden' })).toBeInTheDocument();
    // Choosing a rhythm is not a calm thing to do.
    expect(screen.queryByRole('button', { name: 'Flexibel' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Ruhe-Ansicht beenden' })).not.toBeInTheDocument();
  });
});
