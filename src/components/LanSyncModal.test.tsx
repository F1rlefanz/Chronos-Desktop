import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LanSyncModal } from './LanSyncModal';
import type { Incoming } from '../utils/sync/lan';

/**
 * The waiting half of the dialog, which is the half nobody is touching: it polls
 * once a second, and everything it does happens without a click. Fake timers and
 * a stubbed transport are the only way to see any of it.
 */
const startListening = vi.fn();
const stopListening = vi.fn();
const takeReceived = vi.fn<() => Promise<Incoming>>();

vi.mock('../utils/sync/lan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/sync/lan')>();
  return {
    ...actual,
    startListening: (...args: unknown[]) => startListening(...args),
    stopListening: () => stopListening(),
    takeReceived: () => takeReceived(),
  };
});

/** Runs the poll once and lets the promises inside it settle. */
async function poll(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(1000);
    // One tick per await inside the poll: the ask, the merge, and the setState
    // that follows it. `findBy*` cannot help here — it waits on real time.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

function open(onReceive = vi.fn(async () => 'zusammengeführt')) {
  render(
    <LanSyncModal
      isOpen
      onClose={vi.fn()}
      buildPayload={() => '{"device":"a"}'}
      onReceive={onReceive}
    />
  );
  return onReceive;
}

describe('LanSyncModal while it waits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startListening.mockResolvedValue({ address: '192.168.178.43', port: 45888, code: '123456' });
    stopListening.mockResolvedValue(undefined);
    takeReceived.mockResolvedValue({ payload: null, exhausted: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the address and the code the other device has to be given', async () => {
    open();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('192.168.178.43')).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
  });

  /**
   * The reason this file exists. `lan_received` used to answer with the payload
   * itself, so "nothing arrived" was a falsy `null`; it now answers with an
   * object that is truthy either way. An empty poll must still merge nothing —
   * without the fix this merged `undefined` once a second.
   */
  it('merges nothing when nothing arrived', async () => {
    const onReceive = open();
    await act(async () => {
      await Promise.resolve();
    });

    await poll();
    await poll();

    expect(onReceive).not.toHaveBeenCalled();
  });

  it('merges what a peer pushed and reports what came of it', async () => {
    const onReceive = open();
    await act(async () => {
      await Promise.resolve();
    });

    takeReceived.mockResolvedValueOnce({ payload: '{"device":"b"}', exhausted: false });
    await poll();

    expect(onReceive).toHaveBeenCalledWith('{"device":"b"}');
    expect(screen.getByText('zusammengeführt')).toBeInTheDocument();
  });

  /**
   * Ten wrong codes close the listener in Rust. From here that is indis-
   * tinguishable from a quiet minute unless the flag is read — and a dialog that
   * goes on showing an address nobody answers on is the failure this prevents.
   */
  it('takes the address away and says so once the listener has given up', async () => {
    open();
    await act(async () => {
      await Promise.resolve();
    });

    takeReceived.mockResolvedValueOnce({ payload: null, exhausted: true });
    await poll();

    expect(screen.queryByText('192.168.178.43')).not.toBeInTheDocument();
    expect(screen.getByText(/falscher Code/)).toBeInTheDocument();
  });

  it('still merges a record that arrived in the same breath as the last refusal', async () => {
    const onReceive = open();
    await act(async () => {
      await Promise.resolve();
    });

    takeReceived.mockResolvedValueOnce({ payload: '{"device":"b"}', exhausted: true });
    await poll();

    expect(onReceive).toHaveBeenCalledWith('{"device":"b"}');
    expect(screen.getByText(/falscher Code/)).toBeInTheDocument();
    expect(screen.getByText('zusammengeführt')).toBeInTheDocument();
  });

  it('stops asking once there is nothing left to ask', async () => {
    open();
    await act(async () => {
      await Promise.resolve();
    });

    takeReceived.mockResolvedValueOnce({ payload: null, exhausted: true });
    await poll();

    const asked = takeReceived.mock.calls.length;
    await poll();
    await poll();

    expect(takeReceived.mock.calls.length).toBe(asked);
  });
});
