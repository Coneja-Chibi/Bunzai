/**
 * What happens to a scene after its turn's stream has closed, announced to the pages (plan 16): the Story Director's background tracker round and the person's Undo of one of its updates.
 * A coarse "the trackers of this chat changed" with what became of each, so a page reads the scene again; the app-wide studio-events stream (ui/agent/studio-events.ts) carries it to every
 * open window. In-process only: nothing here is stored.
 */
import type { TrackerModule } from "../stage/contracts/chat-tracker-types";

export type TrackerOutcome = "applied" | "skipped" | "dropped" | "failed" | "undone";
export interface TrackerOutcomes { module: TrackerModule; outcome: TrackerOutcome }
/** The event: which scene, and what became of each tracker the round or the Undo looked at. */
export interface SceneTrackersEvent { chatId: string; modules: TrackerOutcomes[] }

const listeners = new Set<(e: SceneTrackersEvent) => void>();

/** Tells every listener; one that throws does not stop the others. */
export function publishSceneTrackers(e: SceneTrackersEvent): void {
  for (const l of [...listeners]) { try { l(e); } catch { /* a listener's failure is its own */ } }
}

export function onSceneTrackers(cb: (e: SceneTrackersEvent) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
