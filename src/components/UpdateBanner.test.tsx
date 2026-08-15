import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';
import { AvailableUpdate } from '../utils/update';

function updateWith(notes: string): AvailableUpdate {
  return { version: '1.1.1', notes, install: vi.fn() };
}

const bullets = (count: number) =>
  Array.from({ length: count }, (_, i) => `- Punkt ${i + 1}`).join('\n');

describe('UpdateBanner', () => {
  it('shows the version and the changelog bullets', () => {
    render(
      <UpdateBanner
        update={updateWith('### Fixed\n\n- **Etwas** wurde behoben.\n- Und noch etwas.')}
        handsOverToSystem={false}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText(/Version 1\.1\.1 ist da/)).toBeInTheDocument();
    // The heading is dropped and the bold markers are stripped: the notes are
    // Markdown, and this is a banner rather than a rendered document.
    expect(screen.getByText('Etwas wurde behoben.')).toBeInTheDocument();
    expect(screen.queryByText(/### Fixed/)).not.toBeInTheDocument();
  });

  it('counts one remaining change in the singular', () => {
    render(
      <UpdateBanner update={updateWith(bullets(5))} handsOverToSystem={false} onDismiss={vi.fn()} />
    );
    expect(screen.getByText('… und eine weitere Änderung.')).toBeInTheDocument();
  });

  it('counts several in the plural', () => {
    render(
      <UpdateBanner update={updateWith(bullets(7))} handsOverToSystem={false} onDismiss={vi.fn()} />
    );
    expect(screen.getByText('… und 3 weitere Änderungen.')).toBeInTheDocument();
  });

  it('says what will happen, and that differs by platform', () => {
    const { unmount } = render(
      <UpdateBanner update={updateWith('')} handsOverToSystem={false} onDismiss={vi.fn()} />
    );
    expect(screen.getByText(/startet sich danach neu/)).toBeInTheDocument();
    unmount();

    render(<UpdateBanner update={updateWith('')} handsOverToSystem onDismiss={vi.fn()} />);
    expect(screen.getByText(/Androids eigenem Dialog/)).toBeInTheDocument();
  });

  it('renders without a list when the notes carry no bullets', () => {
    render(
      <UpdateBanner
        update={updateWith('Nur ein Absatz ohne Aufzählung.')}
        handsOverToSystem={false}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
