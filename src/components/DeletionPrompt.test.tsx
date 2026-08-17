import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeletionPrompt } from './DeletionPrompt';
import { TimeEntry } from '../types';

function entry(id: string, title: string, startTime: number, minutes: number): TimeEntry {
  return {
    id,
    title,
    project: 'proj-work',
    tags: [],
    startTime,
    endTime: startTime + minutes * 60_000,
    breaks: [],
    createdAt: startTime,
    updatedAt: startTime,
    source: 'stopwatch',
  };
}

const meeting = entry('a', 'Meeting', Date.UTC(2026, 7, 15, 9, 0), 72);
const research = entry('b', 'Recherche', Date.UTC(2026, 7, 14, 9, 0), 47);

describe('DeletionPrompt', () => {
  it('names what would go, so it can be checked against memory', () => {
    render(<DeletionPrompt entries={[meeting, research]} onAdopt={vi.fn()} onKeep={vi.fn()} />);

    expect(screen.getByText('Das andere Gerät hat 2 Einträge gelöscht')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Recherche')).toBeInTheDocument();
  });

  it('counts a single entry in the singular', () => {
    render(<DeletionPrompt entries={[meeting]} onAdopt={vi.fn()} onKeep={vi.fn()} />);
    expect(screen.getByText('Das andere Gerät hat einen Eintrag gelöscht')).toBeInTheDocument();
  });

  /** Eleven entries must not turn the question into the history list. */
  it('shows the first few and says how many more there are', () => {
    const many = Array.from({ length: 11 }, (_, i) =>
      entry(`e${i}`, `Eintrag ${i}`, Date.UTC(2026, 7, 10 + i, 9, 0), 30)
    );

    render(<DeletionPrompt entries={many} onAdopt={vi.fn()} onKeep={vi.fn()} />);

    expect(screen.getByText('Eintrag 0')).toBeInTheDocument();
    expect(screen.queryByText('Eintrag 5')).not.toBeInTheDocument();
    expect(screen.getByText(/und 6 weitere Einträge/)).toBeInTheDocument();
  });

  it('leaves out the remainder line when everything fits', () => {
    render(<DeletionPrompt entries={[meeting]} onAdopt={vi.fn()} onKeep={vi.fn()} />);
    expect(screen.queryByText(/und .* weiter/)).not.toBeInTheDocument();
  });

  /**
   * An entry without a title is the common case for a stopwatch that was
   * started and stopped, and an empty row would be the one nobody recognises.
   */
  it('gives an untitled entry something to be recognised by', () => {
    const untitled = entry('c', '', Date.UTC(2026, 7, 15, 9, 0), 3);

    render(<DeletionPrompt entries={[untitled]} onAdopt={vi.fn()} onKeep={vi.fn()} />);

    expect(screen.getByText('Ohne Titel')).toBeInTheDocument();
  });

  it('reports each answer separately', async () => {
    const onAdopt = vi.fn();
    const onKeep = vi.fn();
    const user = userEvent.setup();

    render(<DeletionPrompt entries={[meeting]} onAdopt={onAdopt} onKeep={onKeep} />);

    await user.click(screen.getByRole('button', { name: /Behalten/ }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onAdopt).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Übernehmen/ }));
    expect(onAdopt).toHaveBeenCalledTimes(1);
  });
});
