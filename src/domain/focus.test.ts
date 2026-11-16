import { describe, it, expect } from 'vitest';
import {
  FLOW_EXTENSION_MS,
  FocusPlan,
  OPEN_SNOOZE_MS,
  OPEN_SUGGEST_AFTER_MS,
  derivePhase,
  extendPhase,
  focusSignal,
  normalizeFocusSettings,
} from './focus';
import type { Break, TimeEntry } from '../types';

const MINUTE = 60_000;
const START = new Date(2026, 0, 15, 9, 0, 0).getTime();

const flex: FocusPlan = { mode: 'flex', focusMs: 25 * MINUTE, breakMs: 5 * MINUTE };
const fixed: FocusPlan = { mode: 'fixed', focusMs: 25 * MINUTE, breakMs: 5 * MINUTE };
const open: FocusPlan = { mode: 'open', focusMs: 25 * MINUTE, breakMs: 5 * MINUTE };

function pause(id: string, fromMin: number, toMin: number | null): Break {
  return {
    id,
    startTime: START + fromMin * MINUTE,
    endTime: toMin === null ? null : START + toMin * MINUTE,
  };
}

function running(breaks: Break[] = []): TimeEntry {
  return {
    id: 'e1',
    title: '',
    project: 'proj-work',
    tags: [],
    startTime: START,
    endTime: null,
    breaks,
    createdAt: START,
    updatedAt: START,
    source: 'stopwatch',
  };
}

const at = (min: number): number => START + min * MINUTE;

describe('derivePhase', () => {
  it('is nothing for an entry that is not running', () => {
    expect(derivePhase(null, flex, at(5))).toBeNull();
    expect(derivePhase({ ...running(), endTime: at(30) }, flex, at(40))).toBeNull();
  });

  it('starts in the first block', () => {
    expect(derivePhase(running(), flex, at(10))).toMatchObject({
      kind: 'focus',
      block: 1,
      phaseStart: START,
      elapsedMs: 10 * MINUTE,
      targetMs: 25 * MINUTE,
    });
  });

  it('counts a block from the end of the last pause, not from the start of the entry', () => {
    const phase = derivePhase(running([pause('b1', 25, 30)]), flex, at(40));
    expect(phase).toMatchObject({
      kind: 'focus',
      block: 2,
      phaseStart: at(30),
      elapsedMs: 10 * MINUTE,
    });
  });

  it('is in a pause while one is open, and says which block it follows', () => {
    const phase = derivePhase(running([pause('b1', 25, null)]), fixed, at(27));
    expect(phase).toMatchObject({
      kind: 'break',
      block: 1,
      phaseStart: at(25),
      elapsedMs: 2 * MINUTE,
    });
    expect(phase?.kind === 'break' && phase.targetMs).toBe(5 * MINUTE);
  });

  it('reads breaks in time order whatever order they are stored in', () => {
    const phase = derivePhase(running([pause('b2', 60, 65), pause('b1', 25, 30)]), flex, at(70));
    expect(phase).toMatchObject({ kind: 'focus', block: 3, phaseStart: at(65) });
  });

  it('has no target in open mode', () => {
    expect(derivePhase(running(), open, at(10))).toMatchObject({ kind: 'focus', targetMs: null });
  });

  it('lets an extension apply only to the phase it was granted in', () => {
    const extension = { phaseStart: START, ms: 10 * MINUTE };
    expect(derivePhase(running(), flex, at(10), extension)).toMatchObject({
      targetMs: 35 * MINUTE,
    });

    // The next block has a different start, so it starts clean.
    const next = derivePhase(running([pause('b1', 35, 40)]), flex, at(45), extension);
    expect(next).toMatchObject({ block: 2, targetMs: 25 * MINUTE });
  });

  it('uses the pause length the user chose, in every mode', () => {
    for (const plan of [fixed, flex, open]) {
      const phase = derivePhase(running([pause('b1', 50, null)]), plan, at(52));
      expect(phase?.kind === 'break' && phase.targetMs).toBe(5 * MINUTE);
    }
  });

  it('does not move the block start back into a pause that contains another', () => {
    // 10-50 with 20-30 inside it: the block after them starts at 50, not 30.
    const phase = derivePhase(
      running([pause('outer', 10, 50), pause('inner', 20, 30)]),
      flex,
      at(60)
    );
    expect(phase).toMatchObject({ kind: 'focus', phaseStart: at(50), elapsedMs: 10 * MINUTE });
  });

  it('counts every pause as the end of a block, however short', () => {
    // A pause and a resume are the user telling Chronos something; no length is
    // too short to be believed.
    const short = [pause('b1', 1, 1.2), pause('b2', 3, 3.1)];
    expect(derivePhase(running(short), fixed, at(5))).toMatchObject({ kind: 'focus', block: 3 });
  });

  it('keeps the pause the same after the fourth block as after the first', () => {
    const phase = derivePhase(
      running([
        pause('b1', 25, 30),
        pause('b2', 55, 60),
        pause('b3', 85, 90),
        pause('b4', 115, null),
      ]),
      fixed,
      at(116)
    );
    expect(phase?.kind === 'break' && phase.targetMs).toBe(5 * MINUTE);
  });
});

describe('extendPhase', () => {
  const phaseAt = (plan: FocusPlan, entry: TimeEntry, min: number) => {
    const phase = derivePhase(entry, plan, at(min));
    if (!phase) throw new Error('no phase');
    return phase;
  };

  it('gives a block that is not over yet the extra time on top of its target', () => {
    const extension = extendPhase(phaseAt(flex, running(), 20), null, 5 * MINUTE);
    expect(derivePhase(running(), flex, at(20), extension)).toMatchObject({
      targetMs: 30 * MINUTE,
    });
  });

  /**
   * Added to the target as it stood, "+10 minutes" on a block that overran by
   * an hour was still in the past and did nothing.
   */
  it('gives a block that overran long ago the extra time from now', () => {
    const extension = extendPhase(phaseAt(flex, running(), 85), null, 10 * MINUTE);
    const after = derivePhase(running(), flex, at(85), extension);

    expect(after?.kind === 'focus' && after.targetMs).toBe(95 * MINUTE);
    expect(focusSignal(after, flex, extension)).toBeNull();
    expect(focusSignal(derivePhase(running(), flex, at(95), extension), flex, extension)).toBe(
      'goal-reached'
    );
  });

  it('does the same for a pause that overran long ago', () => {
    const entry = running([pause('b1', 25, null)]);
    const extension = extendPhase(phaseAt(flex, entry, 60), null, 5 * MINUTE);
    const after = derivePhase(entry, flex, at(60), extension);

    expect(after?.kind === 'break' && after.targetMs).toBe(40 * MINUTE);
    expect(focusSignal(after, flex, extension)).toBeNull();
  });

  it('moves the moment a pause is suggested in open mode', () => {
    const phase = phaseAt(open, running(), 100);
    const extension = extendPhase(phase, null, 30 * MINUTE);
    expect(
      focusSignal(derivePhase(running(), open, at(100), extension), open, extension)
    ).toBeNull();
    expect(focusSignal(derivePhase(running(), open, at(130), extension), open, extension)).toBe(
      'long-run'
    );
  });

  it('adds up when granted twice in the same phase', () => {
    const first = extendPhase(phaseAt(flex, running(), 20), null, 5 * MINUTE);
    const second = extendPhase(phaseAt(flex, running(), 21), first, 5 * MINUTE);
    expect(second.ms).toBe(10 * MINUTE);
  });
});

describe('focusSignal', () => {
  it('says nothing while a block is still under way', () => {
    expect(focusSignal(derivePhase(running(), flex, at(24)), flex)).toBeNull();
    expect(focusSignal(derivePhase(running(), fixed, at(24)), fixed)).toBeNull();
  });

  it('asks in flex mode and acts in fixed mode once the target is reached', () => {
    expect(focusSignal(derivePhase(running(), flex, at(25)), flex)).toBe('goal-reached');
    expect(focusSignal(derivePhase(running(), fixed, at(25)), fixed)).toBe('break-due');
  });

  it('goes quiet again after "Weiter im Fluss" and returns at the new target', () => {
    const extension = { phaseStart: START, ms: FLOW_EXTENSION_MS };
    expect(
      focusSignal(derivePhase(running(), flex, at(26), extension), flex, extension)
    ).toBeNull();
    expect(focusSignal(derivePhase(running(), flex, at(35), extension), flex, extension)).toBe(
      'goal-reached'
    );
  });

  it('suggests a pause in open mode only after a long stretch, and can be put off', () => {
    const justBefore = START + OPEN_SUGGEST_AFTER_MS - MINUTE;
    const due = START + OPEN_SUGGEST_AFTER_MS;
    expect(focusSignal(derivePhase(running(), open, justBefore), open)).toBeNull();
    expect(focusSignal(derivePhase(running(), open, due), open)).toBe('long-run');

    const snoozed = { phaseStart: START, ms: OPEN_SNOOZE_MS };
    expect(focusSignal(derivePhase(running(), open, due, snoozed), open, snoozed)).toBeNull();
  });

  it('reports the end of a pause in fixed and flex mode, to the second', () => {
    for (const plan of [fixed, flex]) {
      const entry = running([pause('b1', 25, null)]);
      // The pause opened at minute 25 and lasts five minutes.
      expect(focusSignal(derivePhase(entry, plan, at(30) - 1), plan)).toBeNull();
      expect(focusSignal(derivePhase(entry, plan, at(30)), plan)).toBe('break-over');
    }
  });

  it('says nothing about the length of a pause in open mode', () => {
    const entry = running([pause('b1', 25, null)]);
    expect(focusSignal(derivePhase(entry, open, at(200)), open)).toBeNull();
  });

  it('is nothing without a phase', () => {
    expect(focusSignal(null, flex)).toBeNull();
  });
});

describe('normalizeFocusSettings', () => {
  const fallback = { focusMode: 'flex' as const, focusMinutes: 25, breakMinutes: 5 };

  it('keeps valid values', () => {
    const valid = { focusMode: 'fixed' as const, focusMinutes: 50, breakMinutes: 10 };
    expect(normalizeFocusSettings(valid, fallback)).toEqual(valid);
  });

  it('refuses a mode it does not know', () => {
    const raw = { focusMode: 'banana' as never, focusMinutes: 25, breakMinutes: 5 };
    expect(normalizeFocusSettings(raw, fallback).focusMode).toBe('flex');
  });

  it('clamps minutes so a block can neither end instantly nor never', () => {
    const tooSmall = normalizeFocusSettings(
      { focusMode: 'flex', focusMinutes: 0, breakMinutes: -4 },
      fallback
    );
    expect(tooSmall).toMatchObject({ focusMinutes: 5, breakMinutes: 1 });

    const tooBig = normalizeFocusSettings(
      { focusMode: 'flex', focusMinutes: 9999, breakMinutes: 500 },
      fallback
    );
    expect(tooBig).toMatchObject({ focusMinutes: 240, breakMinutes: 120 });
  });

  it('falls back for a value that is not a number', () => {
    const raw = { focusMode: 'flex' as const, focusMinutes: NaN, breakMinutes: Infinity };
    expect(normalizeFocusSettings(raw, fallback)).toMatchObject({
      focusMinutes: 25,
      breakMinutes: 5,
    });
  });
});
