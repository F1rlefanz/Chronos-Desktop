import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  migrateSettings,
  loadPersistedState,
  saveSettings,
  saveTimeEntries,
  saveProjects,
  setStorageAdapter,
} from './index';
import { createMemoryAdapter } from './memoryAdapter';
import { localStorageAdapter } from './localStorageAdapter';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROJECTS,
  STORAGE_KEYS,
} from '../../constants/defaultConfig';

describe('migrateSettings', () => {
  it('falls back to the defaults for anything that is not an object', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(migrateSettings('nonsense')).toEqual(DEFAULT_APP_SETTINGS);
    expect(migrateSettings(undefined)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('keeps stored values that still exist', () => {
    const migrated = migrateSettings({ soundEnabled: false, timerIntervalMs: 1000 });
    expect(migrated.soundEnabled).toBe(false);
    expect(migrated.timerIntervalMs).toBe(1000);
  });

  it('fills in keys the stored settings never had', () => {
    const migrated = migrateSettings({ soundEnabled: false });
    expect(migrated.showMilliseconds).toBe(DEFAULT_APP_SETTINGS.showMilliseconds);
    expect(migrated.keyShortcutsEnabled).toBe(DEFAULT_APP_SETTINGS.keyShortcutsEnabled);
  });

  it('drops settings that no longer exist', () => {
    // A state written by an older build, carrying the three dead settings.
    const migrated = migrateSettings({
      soundEnabled: true,
      theme: 'dark',
      timeFormat: '24h',
      autoSaveSession: true,
      // Dropped when the fake title bar it controlled was removed.
      desktopWindowFrame: true,
    });

    expect(migrated).not.toHaveProperty('theme');
    expect(migrated).not.toHaveProperty('timeFormat');
    expect(migrated).not.toHaveProperty('autoSaveSession');
    expect(migrated).not.toHaveProperty('desktopWindowFrame');
    expect(Object.keys(migrated).sort()).toEqual(Object.keys(DEFAULT_APP_SETTINGS).sort());
  });

  it('ignores stored values whose type no longer matches', () => {
    const migrated = migrateSettings({ soundEnabled: 'yes', timerIntervalMs: '1000' });
    expect(migrated.soundEnabled).toBe(DEFAULT_APP_SETTINGS.soundEnabled);
    expect(migrated.timerIntervalMs).toBe(DEFAULT_APP_SETTINGS.timerIntervalMs);
  });
});

describe('loadPersistedState', () => {
  const adapter = createMemoryAdapter();

  beforeEach(() => {
    adapter.clear();
    setStorageAdapter(adapter);
  });

  // The default adapter is process-wide; leaving the memory one in place would
  // leak into any suite that runs after this file.
  afterAll(() => {
    setStorageAdapter(localStorageAdapter);
  });

  it('returns the defaults when nothing is stored', async () => {
    const state = await loadPersistedState();

    expect(state.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(state.entries).toEqual([]);
    expect(state.projects).toEqual(DEFAULT_PROJECTS);
  });

  it('survives corrupt JSON in storage', async () => {
    adapter.seed(STORAGE_KEYS.SETTINGS, '{not json');
    adapter.seed(STORAGE_KEYS.TIME_ENTRIES, '[[[');

    const state = await loadPersistedState();

    expect(state.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(state.entries).toEqual([]);
  });

  it('migrates a stored state written by an older build', async () => {
    adapter.seed(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({ soundEnabled: false, theme: 'dark', timeFormat: '12h' })
    );

    const { settings } = await loadPersistedState();

    expect(settings.soundEnabled).toBe(false);
    expect(settings).not.toHaveProperty('theme');
  });

  it('writes the cleaned state back so the stale keys do not linger', async () => {
    adapter.seed(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({ soundEnabled: false, theme: 'dark', autoSaveSession: true })
    );

    await loadPersistedState();

    const persisted = JSON.parse(adapter.peek(STORAGE_KEYS.SETTINGS) ?? '{}');
    expect(Object.keys(persisted).sort()).toEqual(Object.keys(DEFAULT_APP_SETTINGS).sort());
    expect(persisted.soundEnabled).toBe(false);
  });

  it('does not rewrite storage when the stored state is already current', async () => {
    const current = { ...DEFAULT_APP_SETTINGS, soundEnabled: false };
    adapter.seed(STORAGE_KEYS.SETTINGS, JSON.stringify(current));
    // Including the device id: without it, the one write this start *does* owe
    // storage would be mistaken for the rewrite this test is about.
    adapter.seed(STORAGE_KEYS.DEVICE_ID, 'aabbccddeeff');
    const write = vi.spyOn(adapter, 'write');

    await loadPersistedState();

    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  // Found on a phone: the settings came back as defaults while the entries
  // survived, because only the settings are ever written back. One unreadable
  // file had quietly become a permanent reset.
  describe('when the backend cannot be read', () => {
    it('writes nothing back over data it could not read', async () => {
      adapter.seed(STORAGE_KEYS.SETTINGS, JSON.stringify({ soundEnabled: false }));
      adapter.failReads('Die Ablage antwortet nicht.');
      const write = vi.spyOn(adapter, 'write');

      await loadPersistedState();

      expect(write).not.toHaveBeenCalled();
      write.mockRestore();
    });

    it('leaves the stored value untouched, so a restart can still find it', async () => {
      const stored = JSON.stringify({ ...DEFAULT_APP_SETTINGS, soundEnabled: false });
      adapter.seed(STORAGE_KEYS.SETTINGS, stored);
      adapter.failReads('Die Ablage antwortet nicht.');

      await loadPersistedState();
      adapter.failReads(null);
      const { settings } = await loadPersistedState();

      expect(settings.soundEnabled).toBe(false);
    });

    it('says what it could not read, so the app can warn before anything is recorded', async () => {
      adapter.failReads('Die Ablage antwortet nicht.');

      const { unreadable } = await loadPersistedState();

      expect(unreadable).toContain('die Einstellungen');
      expect(unreadable).toContain('die Einträge');
    });

    it('reports nothing unreadable on an ordinary start', async () => {
      const { unreadable } = await loadPersistedState();

      expect(unreadable).toEqual([]);
    });
  });

  describe('the device id', () => {
    it('is generated once and written back, so the next start reuses it', async () => {
      const first = await loadPersistedState();

      expect(first.deviceId).toMatch(/^[0-9a-f]{12}$/);
      expect(adapter.peek(STORAGE_KEYS.DEVICE_ID)).toBe(first.deviceId);

      const second = await loadPersistedState();
      expect(second.deviceId).toBe(first.deviceId);
    });

    it('replaces one that is not an id, rather than syncing under it', async () => {
      adapter.seed(STORAGE_KEYS.DEVICE_ID, '../../elsewhere');

      const { deviceId } = await loadPersistedState();

      expect(deviceId).toMatch(/^[0-9a-f]{12}$/);
    });
  });

  it('starts anyway when the migration write-back is rejected', async () => {
    adapter.seed(STORAGE_KEYS.SETTINGS, JSON.stringify({ soundEnabled: false, theme: 'dark' }));
    adapter.failWrites({ ok: false, reason: 'quota', message: 'full' });

    const { settings } = await loadPersistedState();

    expect(settings.soundEnabled).toBe(false);
  });

  it('round-trips everything it saves', async () => {
    const settings = { ...DEFAULT_APP_SETTINGS, soundEnabled: false, timerIntervalMs: 100 };
    const projects = [{ id: 'proj-x', name: 'X', color: '#000000' }];

    expect(await saveSettings(settings)).toEqual({ ok: true });
    expect(await saveProjects(projects)).toEqual({ ok: true });
    expect(await saveTimeEntries([])).toEqual({ ok: true });

    const state = await loadPersistedState();
    expect(state.settings).toEqual(settings);
    expect(state.projects).toEqual(projects);
    expect(state.entries).toEqual([]);
  });

  it('passes a rejected write through to the caller', async () => {
    adapter.failWrites({ ok: false, reason: 'quota', message: 'full' });

    expect(await saveSettings(DEFAULT_APP_SETTINGS)).toEqual({
      ok: false,
      reason: 'quota',
      message: 'full',
    });
  });
});
