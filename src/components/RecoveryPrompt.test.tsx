import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryPrompt } from './RecoveryPrompt';
import type { TimeEntry } from '../types';

function runningEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    title: 'Interrupted work',
    project: 'proj-work',
    tags: [],
    startTime: Date.now() - 90 * 60 * 1000,
    endTime: null,
    breaks: [],
    createdAt: Date.now() - 90 * 60 * 1000,
    source: 'stopwatch',
    ...overrides,
  };
}

function renderPrompt() {
  const handlers = {
    onContinue: vi.fn(),
    onStopNow: vi.fn(),
    onEdit: vi.fn(),
  };
  render(<RecoveryPrompt entry={runningEntry()} {...handlers} />);
  return handlers;
}

describe('RecoveryPrompt', () => {
  it('names the measurement and how much time it has counted', () => {
    renderPrompt();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Interrupted work')).toBeInTheDocument();
    expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
  });

  it('offers all three answers, because none of them is the safe default', async () => {
    const user = userEvent.setup();
    const handlers = renderPrompt();

    await user.click(screen.getByRole('button', { name: /keep it running/i }));
    expect(handlers.onContinue).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /stop now/i }));
    expect(handlers.onStopNow).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /correct the times/i }));
    expect(handlers.onEdit).toHaveBeenCalledOnce();
  });

  it('reassures that nothing was lost — the entry was stored on start', () => {
    renderPrompt();
    expect(screen.getByText(/nothing has been lost/i)).toBeInTheDocument();
  });
});
