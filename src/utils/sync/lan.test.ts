import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, newPairingCode, parseTarget } from './lan';

describe('parseTarget', () => {
  it('assumes the preferred port when only an address was typed', () => {
    expect(parseTarget('192.168.178.43')).toEqual({
      address: '192.168.178.43',
      port: DEFAULT_PORT,
    });
  });

  it('takes the port when the other device had to use a different one', () => {
    expect(parseTarget('192.168.178.43:49152')).toEqual({
      address: '192.168.178.43',
      port: 49152,
    });
  });

  it('forgives the spaces that come with reading a number off a screen', () => {
    expect(parseTarget('  192.168.178.43  ')?.address).toBe('192.168.178.43');
  });

  it('refuses what is not an address', () => {
    for (const input of ['', '   ', ':45888', '192.168.178.43:', '192.168.178.43:0']) {
      expect(parseTarget(input)).toBeNull();
    }
  });

  it('refuses a port outside the range instead of sending it on to fail', () => {
    expect(parseTarget('192.168.178.43:70000')).toBeNull();
    expect(parseTarget('192.168.178.43:zwölf')).toBeNull();
  });

  // An IPv6 address would parse as an address and a nonsense port. Refusing it
  // here means the message says the address is wrong, which it is for us: the
  // listener reports an IPv4 address or none at all.
  it('refuses an address with more than one colon', () => {
    expect(parseTarget('fe80::1')).toBeNull();
  });
});

describe('newPairingCode', () => {
  it('is always six digits, so what is on one screen fits the field on the other', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newPairingCode()).toMatch(/^\d{6}$/);
    }
  });
});
