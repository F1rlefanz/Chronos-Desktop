import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StopwatchDisplay } from './StopwatchDisplay';
import { DEFAULT_PROJECTS } from '../constants/defaultConfig';

function renderDisplay(children?: React.ReactNode) {
  return render(
    <StopwatchDisplay
      elapsedTimeMs={0}
      timerState="IDLE"
      showMilliseconds={false}
      breakCount={0}
      projects={DEFAULT_PROJECTS}
      activeProjectId="proj-work"
      onSelectProject={() => {}}
    >
      {children}
    </StopwatchDisplay>
  );
}

describe('StopwatchDisplay', () => {
  it('offers every project in the picker', () => {
    renderDisplay();

    const picker = screen.getByRole('combobox', { name: 'Projekt' });
    expect(picker).toHaveValue('proj-work');
    expect(screen.getAllByRole('option')).toHaveLength(DEFAULT_PROJECTS.length);
  });

  // The controls used to sit below the card, detached from the readout they
  // act on. They are passed in as children so this component stays
  // presentational and knows nothing about the timer's handlers.
  it('renders the controls it is given inside the card', () => {
    renderDisplay(<button>STARTEN</button>);

    expect(screen.getByRole('region', { name: 'Zeiterfassung' })).toContainElement(
      screen.getByRole('button', { name: 'STARTEN' })
    );
  });

  it('works without controls', () => {
    renderDisplay();

    expect(screen.getByRole('combobox', { name: 'Projekt' })).toBeInTheDocument();
  });
});
