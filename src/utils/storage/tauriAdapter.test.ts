import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

const { tauriAdapter } = await import('./tauriAdapter');

describe('tauriAdapter', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('reads through the storage_read command', async () => {
    invoke.mockResolvedValue('{"soundEnabled":false}');

    expect(await tauriAdapter.read('settings_v1')).toBe('{"soundEnabled":false}');
    expect(invoke).toHaveBeenCalledWith('storage_read', { key: 'settings_v1' });
  });

  it('passes a missing key through as null', async () => {
    invoke.mockResolvedValue(null);

    expect(await tauriAdapter.read('never-written')).toBeNull();
  });

  it('does not let a failed read stop the app from starting', async () => {
    invoke.mockRejectedValue({ reason: 'io', message: 'Disk on fire.' });

    expect(await tauriAdapter.read('settings_v1')).toBeNull();
  });

  it('writes through the storage_write command', async () => {
    invoke.mockResolvedValue(null);

    expect(await tauriAdapter.write('settings_v1', '{}')).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('storage_write', { key: 'settings_v1', value: '{}' });
  });

  it("keeps the Rust side's reason and message", async () => {
    invoke.mockRejectedValue({ reason: 'quota', message: 'The disk is full.' });

    expect(await tauriAdapter.write('settings_v1', '{}')).toEqual({
      ok: false,
      reason: 'quota',
      message: 'The disk is full.',
    });
  });

  it('falls back when the rejection is not a storage error', async () => {
    // A command that never ran rejects with a plain string, not our struct.
    invoke.mockRejectedValue('command chronos_storage_write not found');

    expect(await tauriAdapter.write('settings_v1', '{}')).toEqual({
      ok: false,
      reason: 'unavailable',
      message: 'The desktop backend did not respond to the save.',
    });
  });

  it('rejects a struct carrying an unknown reason', async () => {
    invoke.mockRejectedValue({ reason: 'gremlins', message: 'Something.' });

    expect(await tauriAdapter.write('settings_v1', '{}')).toMatchObject({
      reason: 'unavailable',
    });
  });
});
