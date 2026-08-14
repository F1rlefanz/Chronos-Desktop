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
    const write = vi.spyOn(adapter, 'write');

    await loadPersistedState();

    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
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
