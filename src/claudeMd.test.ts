import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CLAUDE.md is loaded in full in every agent session. It had grown to 30 KB of conventions, read
 * on every task whether the task touched sync, layout or nothing of the kind. The conventions now
 * live per area in `docs/conventions/`, and CLAUDE.md is the signpost to them.
 *
 * This keeps both halves honest: the signpost stays small, and no part of the moved knowledge is
 * lost because nothing points at it any more. If it gets tight, move text out — do not raise the
 * limit.
 */

const ROOT = process.cwd();
const CONVENTIONS = join(ROOT, 'docs', 'conventions');
const MAX_LINES = 180;
const MAX_BYTES = 12_000;

const signpost = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf-8');

describe('CLAUDE.md as a signpost', () => {
  it(`stays within ${MAX_LINES} lines and ${MAX_BYTES} bytes`, () => {
    expect(signpost.split('\n').length).toBeLessThanOrEqual(MAX_LINES);
    expect(Buffer.byteLength(signpost, 'utf-8')).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('points only at convention files that exist', () => {
    const links = [...signpost.matchAll(/docs\/conventions\/([\w-]+\.md)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const name of links) {
      expect(existsSync(join(CONVENTIONS, name)), `docs/conventions/${name} is missing`).toBe(true);
    }
  });

  it('links every convention file', () => {
    const files = readdirSync(CONVENTIONS).filter((name) => name.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      expect(signpost, `docs/conventions/${name} is not linked`).toContain(
        `docs/conventions/${name}`
      );
    }
  });
});
