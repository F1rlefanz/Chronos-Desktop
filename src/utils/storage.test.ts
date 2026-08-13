import { describe, it, expect, beforeEach } from 'vitest';
import { migrateSettings, loadSettings, saveSettings } from './storage';
import { DEFAULT_APP_SETTINGS, STORAGE_KEYS } from '../constants/defaultConfig';

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
    });

    expect(migrated).not.toHaveProperty('theme');
    expect(migrated).not.toHaveProperty('timeFormat');
    expect(migrated).not.toHaveProperty('autoSaveSession');
    expect(Object.keys(migrated).sort()).toEqual(Object.keys(DEFAULT_APP_SETTINGS).sort());
  });

  it('ignores stored values whose type no longer matches', () => {
    const migrated = migrateSettings({ soundEnabled: 'yes', timerIntervalMs: '1000' });
    expect(migrated.soundEnabled).toBe(DEFAULT_APP_SETTINGS.soundEnabled);
    expect(migrated.timerIntervalMs).toBe(DEFAULT_APP_SETTINGS.timerIntervalMs);
  });
});

describe('loadSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('survives corrupt JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, '{not json');
    expect(loadSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('migrates a stored state written by an older build', () => {
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({ soundEnabled: false, theme: 'dark', timeFormat: '12h' })
    );

    const loaded = loadSettings();
    expect(loaded.soundEnabled).toBe(false);
    expect(loaded).not.toHaveProperty('theme');
  });

  it('round-trips what it saves', () => {
    const next = { ...DEFAULT_APP_SETTINGS, soundEnabled: false, timerIntervalMs: 100 };
    expect(saveSettings(next)).toBe(true);
    expect(loadSettings()).toEqual(next);
  });
});
