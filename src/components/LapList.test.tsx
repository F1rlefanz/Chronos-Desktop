import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LapList } from './LapList';
import type { Lap } from '../types';

function makeLap(lapNumber: number, lapTimeMs: number): Lap {
  return {
    id: `lap-${lapNumber}`,
    lapNumber,
    lapTimeMs,
    splitTimeMs: lapTimeMs * lapNumber,
    timestamp: 1_700_000_000_000 + lapNumber,
  };
}

describe('LapList', () => {
  it('renders nothing without laps', () => {
    const { container } = render(<LapList laps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks neither lap when a single lap exists', () => {
    render(<LapList laps={[makeLap(1, 1000)]} />);
    expect(screen.queryByText('Fastest')).not.toBeInTheDocument();
    expect(screen.queryByText('Slowest')).not.toBeInTheDocument();
  });

  it('marks exactly one fastest and one slowest lap', () => {
    render(<LapList laps={[makeLap(2, 1500), makeLap(1, 900)]} />);
    expect(screen.getAllByText('Fastest')).toHaveLength(1);
    expect(screen.getAllByText('Slowest')).toHaveLength(1);
  });

  it('marks no lap when every lap took the same time', () => {
    // Regression: min === max used to tag every lap as both fastest and slowest.
    render(<LapList laps={[makeLap(1, 1000), makeLap(2, 1000), makeLap(3, 1000)]} />);
    expect(screen.queryByText('Fastest')).not.toBeInTheDocument();
    expect(screen.queryByText('Slowest')).not.toBeInTheDocument();
  });

  it('shows the lap count', () => {
    render(<LapList laps={[makeLap(1, 1000), makeLap(2, 2000)]} />);
    expect(screen.getByText('2 laps')).toBeInTheDocument();
  });
});
