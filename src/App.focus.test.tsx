import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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

  /**
   * Review findings 2 to 4, written as failing tests before the fixes: each
   * describes something a user can do and the result they would not expect.
   */
  it('lets one click on "Weiter im Fluss" settle a block that overran long ago', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({}, [runningFor(60)])} />);
    await continueRecovered(user);

    const notice = await screen.findByRole('status');
    await user.click(within(notice).getByRole('button', { name: /Weiter im Fluss/ }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lets "+5 Min." put a pause that overran long ago behind the user', async () => {
    const user = userEvent.setup();
    const entry = runningFor(40);
    entry.breaks = [{ id: 'b1', startTime: Date.now() - 30 * MINUTE, endTime: null }];
    render(<App initialState={state({}, [entry])} />);
    await continueRecovered(user);
    expect(await screen.findByRole('status')).toHaveTextContent(/Pause ist vorbei/);

    await user.click(screen.getByRole('button', { name: '+5 MIN.' }));

    expect(screen.queryByText(/Pause ist vorbei/)).not.toBeInTheDocument();
  });

  it('does not start or pause the stopwatch when Space is pressed on a button', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    screen.getByRole('button', { name: 'Fest' }).focus();
    await user.keyboard(' ');

    expect(saveTimeEntries).not.toHaveBeenCalled();
  });

  it('keeps the rhythm off while the entry being corrected is open in the form', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({ focusMode: 'fixed' }, [runningFor(40)])} />);

    await user.click(await screen.findByRole('button', { name: /Zeiten korrigieren/ }));
    await screen.findByText('Eintrag bearbeiten');
    // One tick of the app's clock is a second; give it two.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
    });
    expect(saveTimeEntries).not.toHaveBeenCalled();

    // Once the form is closed without saving, the rhythm carries on.
    await user.click(screen.getByRole('button', { name: /Abbrechen/ }));
    await vi.waitFor(() => expect(saveTimeEntries).toHaveBeenCalledTimes(1));
  });

  it('starts the pause when the user chooses it in the question, and not before', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({}, [runningFor(26)])} />);
    await continueRecovered(user);

    const notice = await screen.findByRole('status');
    await user.click(within(notice).getByRole('button', { name: /^Pause \(5 Min\.\)$/ }));

    await vi.waitFor(() => expect(saveTimeEntries).toHaveBeenCalledTimes(1));
    const [saved] = saveTimeEntries.mock.calls[0][0];
    expect(saved.breaks).toHaveLength(1);
    expect(saved.breaks[0].endTime).toBeNull();
  });

  it('closes the pause when the user answers "Nächster Block"', async () => {
    const user = userEvent.setup();
    const entry = runningFor(40);
    entry.breaks = [{ id: 'b1', startTime: Date.now() - 20 * MINUTE, endTime: null }];
    render(<App initialState={state({}, [entry])} />);
    await continueRecovered(user);

    const notice = await screen.findByRole('status');
    await user.click(within(notice).getByRole('button', { name: 'Nächster Block' }));

    await vi.waitFor(() => expect(saveTimeEntries).toHaveBeenCalledTimes(1));
    const [saved] = saveTimeEntries.mock.calls[0][0];
    expect(saved.breaks[0].endTime).not.toBeNull();
  });

  it('puts "Noch nicht" off without pausing anything', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({ focusMode: 'open' }, [runningFor(95)])} />);
    await continueRecovered(user);

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/am Stück/);
    await user.click(within(notice).getByRole('button', { name: 'Noch nicht' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(saveTimeEntries).not.toHaveBeenCalled();
  });

  it('says nothing about the length of a pause in open mode', async () => {
    const user = userEvent.setup();
    const entry = runningFor(200);
    entry.breaks = [{ id: 'b1', startTime: Date.now() - 100 * MINUTE, endTime: null }];
    render(<App initialState={state({ focusMode: 'open' }, [entry])} />);
    await continueRecovered(user);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('gives a block five minutes more with "+5 Min."', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({}, [runningFor(20)])} />);
    await continueRecovered(user);

    expect(screen.getByRole('timer')).toHaveAccessibleName(/: 0[45]:\d\d bis zum Ziel/);
    await user.click(screen.getByRole('button', { name: '+5 MIN.' }));
    expect(screen.getByRole('timer')).toHaveAccessibleName(/: (09|10):\d\d bis zum Ziel/);
  });

  it('lets the next block be shortened coming back from a pause, and keeps it as the default', async () => {
    const user = userEvent.setup();
    const entry = runningFor(40);
    entry.breaks = [{ id: 'b1', startTime: Date.now() - 2 * MINUTE, endTime: null }];
    render(<App initialState={state({}, [entry])} />);
    await continueRecovered(user);

    const field = screen.getByRole('textbox', { name: 'Nächster Block' });
    await user.clear(field);
    await user.type(field, '30');
    await user.tab();

    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ focusMinutes: 30 }));
  });

  it('accepts any length typed into the block field, not only the presets', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    const field = screen.getByRole('textbox', { name: 'Block' });
    await user.clear(field);
    await user.type(field, '45');
    await user.tab();

    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ focusMinutes: 45, breakMinutes: 5 })
    );
    expect(screen.getByRole('timer')).toHaveAccessibleName(/Erster Block: 45:00/);
  });

  it('puts back the old length when something that is not a number is typed', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    const field = screen.getByRole('textbox', { name: 'Block' });
    await user.clear(field);
    await user.tab();

    expect(field).toHaveValue('25');
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('keeps F for the page: not on the evaluation tab and not behind a dialog', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    await user.click(screen.getByRole('button', { name: 'Auswertung' }));
    await user.keyboard('f');
    await user.click(screen.getByRole('button', { name: 'Erfassen' }));
    expect(screen.queryByRole('button', { name: 'Ruhe-Ansicht beenden' })).not.toBeInTheDocument();
  });

  it('does not open the calm view from behind a dialog', async () => {
    const user = userEvent.setup();
    render(<App initialState={state({}, [runningFor(5)])} />);

    await screen.findByRole('dialog');
    await user.keyboard('f');
    expect(screen.queryByRole('button', { name: 'Ruhe-Ansicht beenden' })).not.toBeInTheDocument();
  });

  it('moves the focus to the other calm-view button instead of dropping it', async () => {
    const user = userEvent.setup();
    render(<App initialState={state()} />);

    await user.click(screen.getByRole('button', { name: 'Ruhe-Ansicht' }));
    expect(screen.getByRole('button', { name: 'Ruhe-Ansicht beenden' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Ruhe-Ansicht beenden' }));
    expect(screen.getByRole('button', { name: 'Ruhe-Ansicht' })).toHaveFocus();
  });

  describe('with sound on', () => {
    const oscillators = vi.fn();

    beforeEach(() => {
      oscillators.mockClear();
      class FakeAudioContext {
        state = 'running';
        currentTime = 0;
        destination = {};
        resume = () => Promise.resolve();
        close = () => Promise.resolve();
        createGain = () => ({
          connect: () => {},
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        });
        createOscillator = () => {
          oscillators();
          return {
            connect: () => {},
            frequency: { setValueAtTime: () => {} },
            start: () => {},
            stop: () => {},
          };
        };
      }
      vi.stubGlobal('AudioContext', FakeAudioContext);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sounds once when a block reaches its target, and not again on the next ticks', async () => {
      const user = userEvent.setup();
      render(<App initialState={state({ soundEnabled: true }, [runningFor(26)])} />);
      await continueRecovered(user);
      await screen.findByRole('status');

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2300));
      });
      expect(oscillators).toHaveBeenCalledTimes(1);
    });

    it('stays quiet with the sound switched off', async () => {
      const user = userEvent.setup();
      render(<App initialState={state({ soundEnabled: false }, [runningFor(26)])} />);
      await continueRecovered(user);
      await screen.findByRole('status');

      expect(oscillators).not.toHaveBeenCalled();
    });
  });
});
