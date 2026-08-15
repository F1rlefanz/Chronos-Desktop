import { describe, expect, it } from 'vitest';
import { readManifest } from './androidUpdateChannel';

const good = JSON.stringify({
  version: '1.1.0',
  notes: '### Added\n- Etwas Neues',
  url: 'https://github.com/F1rlefanz/Chronos-Desktop/releases/download/v1.1.0/chronos-1.1.0.apk',
});

describe('readManifest', () => {
  it('reads a well-formed manifest', () => {
    expect(readManifest(good)).toEqual({
      version: '1.1.0',
      notes: '### Added\n- Etwas Neues',
      url: 'https://github.com/F1rlefanz/Chronos-Desktop/releases/download/v1.1.0/chronos-1.1.0.apk',
    });
  });

  it('treats missing notes as empty rather than refusing the whole thing', () => {
    const withoutNotes = JSON.stringify({ ...JSON.parse(good), notes: undefined });
    expect(readManifest(withoutNotes)?.notes).toBe('');
  });

  it('refuses what is not JSON, or not an object', () => {
    for (const bad of ['', 'nicht json', '[]', '"1.1.0"', 'null']) {
      expect(readManifest(bad)).toBeNull();
    }
  });

  it('refuses a manifest missing a version or a URL', () => {
    expect(readManifest(JSON.stringify({ url: 'https://github.com/a/b/c.apk' }))).toBeNull();
    expect(readManifest(JSON.stringify({ version: '1.1.0' }))).toBeNull();
  });

  // This URL is handed to Android's package installer. A manifest that has been
  // mangled — truncated, half-written, edited by hand — must not be able to
  // point the download at something else entirely.
  it('refuses anything but HTTPS', () => {
    const insecure = JSON.stringify({
      ...JSON.parse(good),
      url: 'http://github.com/F1rlefanz/Chronos-Desktop/releases/download/v1.1.0/x.apk',
    });
    expect(readManifest(insecure)).toBeNull();
  });

  it('refuses a host that is not GitHub', () => {
    const elsewhere = JSON.stringify({
      ...JSON.parse(good),
      url: 'https://example.invalid/chronos.apk',
    });
    expect(readManifest(elsewhere)).toBeNull();

    // A lookalike host that merely *contains* the right name.
    const lookalike = JSON.stringify({
      ...JSON.parse(good),
      url: 'https://github.com.example.invalid/chronos.apk',
    });
    expect(readManifest(lookalike)).toBeNull();
  });

  it('refuses a URL that does not name an APK', () => {
    const notAnApk = JSON.stringify({
      ...JSON.parse(good),
      url: 'https://github.com/F1rlefanz/Chronos-Desktop/releases/download/v1.1.0/setup.exe',
    });
    expect(readManifest(notAnApk)).toBeNull();
  });

  it('accepts the CDN host release assets actually redirect to', () => {
    const cdn = JSON.stringify({
      ...JSON.parse(good),
      url: 'https://objects.githubusercontent.com/some/path/chronos-1.1.0.apk',
    });
    expect(readManifest(cdn)).not.toBeNull();
  });
});
