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

describe('tauriAdapter backups', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('offers backup support, unlike the browser backend', () => {
    expect(tauriAdapter.backups).toBeDefined();
  });

  it('lists through the backup_list command', async () => {
    invoke.mockResolvedValue(['chronos-backup-2026-08-13-090000-daily.json']);

    expect(await tauriAdapter.backups?.list()).toEqual([
      'chronos-backup-2026-08-13-090000-daily.json',
    ]);
    expect(invoke).toHaveBeenCalledWith('backup_list');
  });

  it('treats an unreadable folder as no backups rather than an error', async () => {
    // The caller uses an empty list to decide "no snapshot today yet"; throwing
    // here would break startup over something recoverable.
    invoke.mockRejectedValue({ reason: 'io', message: 'Cannot read directory.' });

    expect(await tauriAdapter.backups?.list()).toEqual([]);
  });

  it('writes through the backup_write command', async () => {
    invoke.mockResolvedValue(null);

    expect(await tauriAdapter.backups?.write('snap.json', '{}')).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('backup_write', { name: 'snap.json', contents: '{}' });
  });

  it("keeps the Rust side's reason when a snapshot is rejected", async () => {
    invoke.mockRejectedValue({ reason: 'quota', message: 'The disk is full.' });

    expect(await tauriAdapter.backups?.write('snap.json', '{}')).toEqual({
      ok: false,
      reason: 'quota',
      message: 'The disk is full.',
    });
  });

  it('reveals the backups folder, naming it rather than passing a path', async () => {
    invoke.mockResolvedValue(null);

    await tauriAdapter.backups?.reveal();
    expect(invoke).toHaveBeenCalledWith('reveal_folder', { target: 'backups' });
  });
});
