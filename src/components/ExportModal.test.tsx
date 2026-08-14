import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportModal } from './ExportModal';
import { DEFAULT_APP_SETTINGS, DEFAULT_PROJECTS } from '../constants/defaultConfig';
import { setFileSink } from '../utils/fileTarget';
import { TimeEntry } from '../types';

const now = new Date(2026, 7, 14, 12, 0, 0).getTime();

const entry: TimeEntry = {
  id: 'entry-1',
  title: 'Erfasste Zeit',
  project: 'proj-work',
  tags: [],
  startTime: new Date(2026, 7, 14, 9, 0, 0).getTime(),
  endTime: new Date(2026, 7, 14, 11, 0, 0).getTime(),
  breaks: [],
  createdAt: 1,
  source: 'stopwatch',
};

function renderModal() {
  render(
    <ExportModal
      isOpen
      onClose={() => {}}
      entries={[entry]}
      projects={DEFAULT_PROJECTS}
      settings={DEFAULT_APP_SETTINGS}
      now={now}
    />
  );
}

describe('ExportModal result message', () => {
  beforeEach(() => {
    // A sink stands in for the desktop build, where the file is written rather
    // than downloaded and the path is the only feedback there is.
    setFileSink({
      write: (name) => Promise.resolve(`C:\\Chronos\\exports\\${name}`),
      reveal: () => Promise.resolve(),
    });
  });

  afterEach(() => {
    setFileSink(null);
    vi.restoreAllMocks();
  });

  async function exportCsv() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^CSV$/ }));
    await user.click(screen.getByRole('button', { name: /CSV erstellen/ }));
    return user;
  }

  it('reports where the file went', async () => {
    renderModal();
    await exportCsv();

    expect(await screen.findByRole('status')).toHaveTextContent(/Gespeichert unter/);
  });

  // The message names one file made from one set of choices. Leaving it up
  // while the format changes reads as if the new format had been exported too.
  it('drops the message when another format is chosen', async () => {
    renderModal();
    const user = await exportCsv();
    await screen.findByRole('status');

    await user.click(screen.getByRole('button', { name: /^PDF$/ }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('drops the message when the project filter changes', async () => {
    renderModal();
    const user = await exportCsv();
    await screen.findByRole('status');

    await user.selectOptions(screen.getByLabelText('Projekt'), 'proj-work');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
