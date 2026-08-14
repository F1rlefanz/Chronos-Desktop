import { describe, it, expect, afterEach, vi } from 'vitest';
import { isMobilePlatform } from './platform';

function pretendUserAgent(value: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isMobilePlatform', () => {
  it('recognises the Android webview Chronos runs in', () => {
    pretendUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
    );

    expect(isMobilePlatform()).toBe(true);
  });

  it('recognises iOS, which has no file manager either', () => {
    pretendUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148');

    expect(isMobilePlatform()).toBe(true);
  });

  // The trap worth guarding: "Macintosh" contains no mobile marker, but a naive
  // check for "Mac" would match iPad's desktop-mode user agent and vice versa.
  it('does not mistake a desktop for a phone', () => {
    pretendUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36');
    expect(isMobilePlatform()).toBe(false);

    pretendUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');
    expect(isMobilePlatform()).toBe(false);

    pretendUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36');
    expect(isMobilePlatform()).toBe(false);
  });
});
