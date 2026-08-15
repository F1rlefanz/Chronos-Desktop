import { describe, expect, it } from 'vitest';
import { isNewer } from './index';

describe('isNewer', () => {
  it('compares numerically, not as text', () => {
    // The whole reason this exists rather than a string comparison: "1.10.0"
    // sorts before "1.9.0" alphabetically, so a tenth minor release would look
    // like a downgrade and nobody would ever be offered it.
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.9.0', '1.10.0')).toBe(false);
    expect(isNewer('1.0.10', '1.0.9')).toBe(true);
  });

  it('says no to the version already running', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('compares each part in order', () => {
    expect(isNewer('2.0.0', '1.99.99')).toBe(true);
    expect(isNewer('1.1.0', '1.0.99')).toBe(true);
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
    expect(isNewer('0.9.0', '1.0.0')).toBe(false);
  });

  it('forgives a leading v, because tags carry one and package.json does not', () => {
    expect(isNewer('v1.1.0', '1.0.0')).toBe(true);
    expect(isNewer('1.1.0', 'v1.0.0')).toBe(true);
  });

  // A manifest is fetched over the network and decides whether the app offers
  // to replace itself. Anything it cannot read must count as "no update", never
  // as "an update" — the failure has to fall on the safe side.
  it('refuses anything that is not three numbers', () => {
    for (const bad of ['', '1.0', '1.0.0.0', 'latest', '1.0.x', '-1.0.0', '1.0.0-beta']) {
      expect(isNewer(bad, '1.0.0')).toBe(false);
    }
  });

  it('refuses to compare against a current version it cannot read', () => {
    expect(isNewer('2.0.0', 'unbekannt')).toBe(false);
  });
});
