import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmPrompt } from './ConfirmPrompt';

const request = {
  title: 'Wirklich alle Einträge löschen?',
  lines: ['3 Einträge verschwinden aus der Liste.', 'Vorher wird eine Sicherung angelegt.'],
  confirmLabel: 'Alle löschen',
};

describe('ConfirmPrompt', () => {
  it('shows the question and everything it depends on', () => {
    render(<ConfirmPrompt request={request} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Wirklich alle Einträge löschen?')).toBeInTheDocument();
    for (const line of request.lines) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it('reports the two answers separately', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<ConfirmPrompt request={request} onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Alle löschen' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lets the cancel button be named when "Abbrechen" is the wrong word', () => {
    render(
      <ConfirmPrompt
        request={{ ...request, cancelLabel: 'Behalten' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Behalten' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });

  /**
   * The harmless answer comes first and carries the weight. Someone tapping
   * past a dialog on a phone should land on the side that changes nothing.
   */
  it('puts cancelling first, ahead of the destructive answer', () => {
    render(<ConfirmPrompt request={request} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const [first, second] = screen.getAllByRole('button');
    expect(first).toHaveTextContent('Abbrechen');
    expect(second).toHaveTextContent('Alle löschen');
  });
});
