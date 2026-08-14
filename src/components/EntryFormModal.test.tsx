import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryFormModal, EntryDraft } from './EntryFormModal';
import { netMs } from '../domain/timeEntry';
import type { Project, TimeEntry } from '../types';

const PROJECTS: Project[] = [{ id: 'proj-work', name: 'Work', color: '#3b82f6' }];

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    title: 'Evening shift',
    project: 'proj-work',
    tags: [],
    startTime: new Date(2026, 0, 15, 22, 0).getTime(),
    endTime: new Date(2026, 0, 16, 1, 0).getTime(),
    breaks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'manual',
    ...overrides,
  };
}

function renderForm(props: Partial<React.ComponentProps<typeof EntryFormModal>> = {}) {
  const onSave = vi.fn<(draft: EntryDraft) => void>();
  const onClose = vi.fn();

  render(
    <EntryFormModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      entry={null}
      projects={PROJECTS}
      defaultProjectId="proj-work"
      {...props}
    />
  );

  return { onSave, onClose };
}

const start = () => screen.getByLabelText('Beginn') as HTMLInputElement;
const end = () => screen.getByLabelText('Ende') as HTMLInputElement;
const submit = () => screen.getByRole('button', { name: /eintrag anlegen|änderungen speichern/i });

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EntryFormModal', () => {
  it('adds an entry that never saw the stopwatch', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.clear(start());
    await user.type(start(), '2026-01-15T09:00');
    await user.clear(end());
    await user.type(end(), '2026-01-15T11:30');
    await user.click(submit());

    expect(onSave).toHaveBeenCalledOnce();
    const draft = onSave.mock.calls[0][0];
    expect(netMs(draft)).toBe(2.5 * 60 * 60 * 1000);
  });

  it('round-trips an entry that runs past midnight', async () => {
    // The case that is unreachable in a form with a single date field: start
    // and end would land on the same day and the end would precede the start.
    const user = userEvent.setup();
    const overnight = entry();
    const { onSave } = renderForm({ entry: overnight });

    expect(start().value).toBe('2026-01-15T22:00');
    expect(end().value).toBe('2026-01-16T01:00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Edit it — the point being that this is possible at all.
    await user.clear(end());
    await user.type(end(), '2026-01-16T02:00');
    await user.click(submit());

    const draft = onSave.mock.calls[0][0];
    expect(netMs(draft)).toBe(4 * 60 * 60 * 1000);
  });

  it('blocks an end that is not after the beginning', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.clear(start());
    await user.type(start(), '2026-01-15T11:00');
    await user.clear(end());
    await user.type(end(), '2026-01-15T09:00');

    expect(screen.getByRole('alert')).toHaveTextContent('Das Ende muss nach dem Beginn liegen.');
    expect(submit()).toBeDisabled();

    await user.click(submit());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps break timestamps instead of collapsing them into a total', async () => {
    const user = userEvent.setup();
    const withBreaks = entry({
      startTime: new Date(2026, 0, 15, 9, 0).getTime(),
      endTime: new Date(2026, 0, 15, 17, 0).getTime(),
      breaks: [
        {
          id: 'b1',
          startTime: new Date(2026, 0, 15, 11, 0).getTime(),
          endTime: new Date(2026, 0, 15, 11, 15).getTime(),
        },
        {
          id: 'b2',
          startTime: new Date(2026, 0, 15, 13, 0).getTime(),
          endTime: new Date(2026, 0, 15, 13, 30).getTime(),
        },
      ],
    });
    const { onSave } = renderForm({ entry: withBreaks });

    expect(screen.getAllByLabelText('Pausenbeginn')).toHaveLength(2);

    await user.click(submit());

    const draft = onSave.mock.calls[0][0];
    expect(draft.breaks).toHaveLength(2);
    expect(draft.breaks[0]).toMatchObject(withBreaks.breaks[0]);
    expect(draft.breaks[1]).toMatchObject(withBreaks.breaks[1]);
  });

  it('leaves a running entry running unless the user says otherwise', async () => {
    const user = userEvent.setup();
    const running = entry({ endTime: null });
    const { onSave } = renderForm({ entry: running });

    const keepRunning = screen.getByRole('checkbox', { name: /erfassung weiterlaufen lassen/i });
    expect(keepRunning).toBeChecked();
    expect(end()).toBeDisabled();

    await user.click(submit());
    expect(onSave.mock.calls[0][0].endTime).toBeNull();
  });

  it('warns before stopping a running entry through the form', async () => {
    const user = userEvent.setup();
    const running = entry({ endTime: null });
    renderForm({ entry: running });

    await user.click(screen.getByRole('checkbox', { name: /erfassung weiterlaufen lassen/i }));

    expect(screen.getByText(/speichern beendet die erfassung/i)).toBeInTheDocument();
    expect(end()).toBeEnabled();
  });

  it('does not offer the running switch for an entry that already ended', () => {
    renderForm({ entry: entry() });
    expect(screen.queryByRole('checkbox', { name: /erfassung weiterlaufen lassen/i })).toBeNull();
  });
});
