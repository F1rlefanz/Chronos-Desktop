import { TimeEntry, Tombstone } from '../types';

/**
 * Reconciling two devices' records.
 *
 * Deliberately transport-agnostic: it takes two sets and returns one, and knows
 * nothing about where either came from. A shared folder, a file passed by hand
 * or a server would all use exactly this — and which of those Chronos should
 * use is a decision that has not been made, so this does not make it.
 *
 * The rule is last-write-wins per entry, with deletions competing on equal
 * terms. That is honest about its limits: two devices editing *the same* entry
 * keep the newer edit and lose the older one. It never merges field by field,
 * because a half-merged entry — one device's start, the other's end — is a
 * record neither person ever entered.
 */
export interface MergeResult {
  entries: TimeEntry[];
  tombstones: Tombstone[];
  /** What actually changed, for the log and for telling the user. */
  summary: {
    added: number;
    updated: number;
    deleted: number;
    unchanged: number;
  };
}

export interface MergeInput {
  entries: TimeEntry[];
  tombstones: Tombstone[];
}

/** Latest deletion time per id, across both sides. */
function tombstonesById(...sets: Tombstone[][]): Map<string, number> {
  const latest = new Map<string, number>();

  for (const set of sets) {
    for (const stone of set) {
      const known = latest.get(stone.id);
      if (known === undefined || stone.deletedAt > known) {
        latest.set(stone.id, stone.deletedAt);
      }
    }
  }

  return latest;
}

/**
 * Merges two sets of records into one.
 *
 * `mine` wins ties. Equal timestamps mean the same edit or a clock that cannot
 * separate them; preferring the local copy keeps a merge from rewriting what is
 * on screen for no visible reason.
 */
export function mergeEntries(mine: MergeInput, theirs: MergeInput): MergeResult {
  const deletions = tombstonesById(mine.tombstones, theirs.tombstones);
  const summary = { added: 0, updated: 0, deleted: 0, unchanged: 0 };

  const byId = new Map<string, TimeEntry>();
  for (const entry of mine.entries) byId.set(entry.id, entry);

  for (const entry of theirs.entries) {
    const known = byId.get(entry.id);

    if (known === undefined) {
      byId.set(entry.id, entry);
      summary.added += 1;
      continue;
    }

    if (entry.updatedAt > known.updatedAt) {
      byId.set(entry.id, entry);
      summary.updated += 1;
    } else {
      summary.unchanged += 1;
    }
  }

  // Deletion is applied last and beats an edit only when it happened later —
  // otherwise editing an entry on one device would be undone by a deletion the
  // other device performed before that edit.
  const entries: TimeEntry[] = [];
  for (const entry of byId.values()) {
    const deletedAt = deletions.get(entry.id);
    if (deletedAt !== undefined && deletedAt >= entry.updatedAt) {
      summary.deleted += 1;
      continue;
    }
    entries.push(entry);
  }

  // A tombstone for an entry that survived is stale: the entry was edited after
  // the deletion, so the deletion lost and its record would keep re-killing the
  // entry on every future merge.
  const surviving = new Set(entries.map((entry) => entry.id));
  const tombstones = [...deletions.entries()]
    .filter(([id]) => !surviving.has(id))
    .map(([id, deletedAt]) => ({ id, deletedAt }))
    .sort((a, b) => a.deletedAt - b.deletedAt);

  entries.sort((a, b) => b.startTime - a.startTime);

  return { entries, tombstones, summary };
}

/**
 * The entries a device gives up by adopting a merge.
 *
 * Deliberately not `summary.deleted`, which is the count of every deletion the
 * merge settled — including entries only the *other* side still had, and which
 * were therefore never on this screen. Asking someone to confirm losing records
 * they have never seen is how a warning teaches people to click it away.
 *
 * Derived by comparing rather than collected during the merge, because that is
 * the question being asked: not "what did the rule decide" but "what is on this
 * device now and would not be afterwards".
 */
export function entriesLostBy(mine: TimeEntry[], result: MergeResult): TimeEntry[] {
  const surviving = new Set(result.entries.map((entry) => entry.id));
  return mine.filter((entry) => !surviving.has(entry.id));
}

/** Records a deletion so the other side learns about it. */
export function tombstoneFor(id: string, at: number = Date.now()): Tombstone {
  return { id, deletedAt: at };
}

/**
 * Drops tombstones for entries that exist again, and de-duplicates.
 *
 * Called when a deletion is recorded locally, so the list stays a set rather
 * than growing an entry per delete-recreate cycle.
 */
export function pruneTombstones(tombstones: Tombstone[], entries: TimeEntry[]): Tombstone[] {
  const live = new Set(entries.map((entry) => entry.id));
  const latest = tombstonesById(tombstones);

  return [...latest.entries()]
    .filter(([id]) => !live.has(id))
    .map(([id, deletedAt]) => ({ id, deletedAt }))
    .sort((a, b) => a.deletedAt - b.deletedAt);
}
