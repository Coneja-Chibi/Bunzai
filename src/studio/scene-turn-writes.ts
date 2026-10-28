/**
 * The scene-state deltas a turn has pending, and the one door the trackers' update tool writes through: `append` adds deltas to the set the turn
 * keeps on its checkpoint (`commitTurn` stamps that set on the version it stores, and a dropped turn loses it), so a swipe, a regenerate or a cut
 * of the reply takes the tool's writes back with it. The door takes tracker slots only (tracker-record:* and tracker-list:*), is handed to the
 * tracker tool alone, and has no size cap: a write is as large as the model's own output. A save that did not happen (the checkpoint is gone,
 * the library is busy) is a failure the model is told of, with nothing kept. The turn opens it once its checkpoint exists, with the deltas it
 * already holds and how to save them.
 */
import type { Delta } from "../core/scene-state/types";

export interface TurnWrites {
  /** The clock the turn runs on, for the time of a write. */
  now(): number;
  /** Adds deltas and saves the whole set; an error in words for the model when they are not tracker slots or the save fails, with nothing kept. */
  append(deltas: readonly Delta[]): Promise<string | null>;
  /** The turn's side: the set it already holds, and how a set is saved on the checkpoint (its answer is null when the checkpoint is gone). */
  open(pending: readonly Delta[], save: (all: Delta[]) => Promise<unknown>): void;
}

/** A slot the door takes: a tracker's record or list, with a member id after the colon. */
const TRACKER_SLOT = /^tracker-(?:record|list):(?!\*$).+$/;

export function turnWrites(now: () => number): TurnWrites {
  let held: Delta[] = [];
  let save: ((all: Delta[]) => Promise<unknown>) | null = null;
  return {
    now,
    open: (pending, to) => {
      held = [...pending];
      save = to;
    },
    append: async (deltas) => {
      if (!save) return "The reply is not open for state changes yet.";
      if (deltas.some((d) => !TRACKER_SLOT.test(d.slot))) return "That change is not to a tracker, so nothing in that call was written.";
      if (deltas.length === 0) return null;
      const next = [...held, ...deltas];
      try {
        if ((await save(next)) === null) return "The state change could not be saved, so nothing in that call was written.";
      } catch {
        return "The state change could not be saved, so nothing in that call was written.";
      }
      held = next;
      return null;
    },
  };
}
