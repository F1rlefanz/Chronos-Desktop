import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// The storage layer already swallows write failures and returns false; what is
// under test here is that App does something visible with that false. Before
// this existed, a rejected write lost the data with no trace in the UI.
const saveSettings = vi.fn(() => true);

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

/** The header's audio toggle is the shortest path to a settings write. */
function toggleAudioCues() {
  return screen.getByTitle(/Audio cues (enabled|muted)/);
}

describe('App persistence warnings', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('says nothing while writes succeed', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(toggleAudioCues());

    expect(screen.queryByText(/Could not save/)).not.toBeInTheDocument();
  });

  it('warns when a write is rejected', async () => {
    const user = userEvent.setup();
    saveSettings.mockReturnValue(false);
    render(<App />);

    await user.click(toggleAudioCues());

    expect(screen.getByText(/Could not save your settings/)).toBeInTheDocument();
    expect(screen.getByText(/gone after a reload/)).toBeInTheDocument();
  });

  it('clears the warning once a write succeeds again', async () => {
    const user = userEvent.setup();
    saveSettings.mockReturnValue(false);
    render(<App />);

    await user.click(toggleAudioCues());
    expect(screen.getByText(/Could not save your settings/)).toBeInTheDocument();

    saveSettings.mockReturnValue(true);
    await user.click(toggleAudioCues());

    expect(screen.queryByText(/Could not save your settings/)).not.toBeInTheDocument();
  });

  it('can be dismissed by the user', async () => {
    const user = userEvent.setup();
    saveSettings.mockReturnValue(false);
    render(<App />);

    await user.click(toggleAudioCues());
    await user.click(screen.getByRole('button', { name: 'Dismiss warning' }));

    expect(screen.queryByText(/Could not save your settings/)).not.toBeInTheDocument();
  });
});
