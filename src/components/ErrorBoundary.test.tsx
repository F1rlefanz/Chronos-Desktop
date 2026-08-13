import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('render exploded');
  return <p>all good</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error itself; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows the fallback instead of a blank page when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something broke while rendering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the app' })).toBeInTheDocument();
    expect(screen.queryByText('all good')).not.toBeInTheDocument();
  });

  it('keeps the error message available for diagnosis', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('render exploded')).toBeInTheDocument();
  });
});
