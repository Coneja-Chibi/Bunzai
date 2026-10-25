/**
 * The Story Director's state helpers (ChatStore rule 47): the empty state a story starts from, the live view of each collection (soft-removed items hidden), and the turn count.
 * The turn is stored in the state (`turn`, one more than the last turn the Director took, a failed one included), never read off the window of messages, which hiding and Max Messages shorten;
 * `turnOf` is the plain count of user messages, kept for the tests and for a state that has none yet.
 */
import type { DirectorArc, DirectorInvisibleArc, DirectorNote, DirectorSeed, DirectorState } from "../../stage/contracts/director-types";

export function emptyDirectorState(): DirectorState {
  return {
    chapters: [], arcs: [], seeds: [], invisibleArcs: [], notes: [], recentAnalysis: [], nextIntentions: [], suggestedActions: [], activity: [], nextId: 1,
    pacing: {
      currentMood: "ambient", turnsAtCurrentMood: 0, recentMoodHistory: [], rhythm: { lastActionSequence: 0, lastQuietMoment: 0, lastEmotionalBeat: 0 }, chapterPhase: "development",
      recommendations: { needsQuietMoment: false, needsTension: false, readyForClimax: false, needsBreather: false },
    },
  };
}

const live = <T extends { removedAt?: number }>(list: readonly T[]): T[] => list.filter((x) => x.removedAt === undefined);
export const liveArcs = (s: DirectorState): DirectorArc[] => live(s.arcs);
export const liveSeeds = (s: DirectorState): DirectorSeed[] => live(s.seeds);
export const liveInvisible = (s: DirectorState): DirectorInvisibleArc[] => live(s.invisibleArcs);
export const liveNotes = (s: DirectorState): DirectorNote[] => live(s.notes);

/** The turn a reply answers: the user messages in the take up to and including the one being answered. */
export const turnOf = (history: readonly { role: string }[], current: { role: string }): number => [...history, current].filter((m) => m.role === "user").length;
