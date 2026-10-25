/**
 * What keeps the Director's state inside the store's size limit as a story runs for hundreds of turns (ChatStore rule 47). The planner is told to touch every pending seed every turn, so a
 * story would otherwise grow without end. Two tools, both pure and both blind to authorship in one way only: `prune` keeps the newest DIRECTOR_FINISHED_KEEP finished seeds, arcs and hidden
 * arcs the model made; `fitState` is what runs when a state is still too large: it gives up, in this order, the oldest activity lines, the older finished model-made items, the oldest stages,
 * reinforcements, clues and analyses, the long texts of model-made items, the model's oldest live arcs, seeds and hidden arcs beyond a working set, and the oldest remembered edits. It NEVER removes anything a person wrote or planted (their notes, their hidden arcs, however they were removed): those
 * stay, soft-removed or not, and a state that is too large with only those left is returned as it is, for the store to refuse and the page to say so.
 */
import { DIRECTOR_FINISHED_KEEP, DIRECTOR_STATE_BYTES_MAX, type DirectorState } from "../../stage/contracts/director-types";

/** What a story keeps when it has outgrown the limit: the model's newest arcs, seeds and hidden arcs. */
const WORKING_ARCS = 40;
const WORKING_SEEDS = 100;
const WORKING_HIDDEN = 40;

const oldestFirst = <T>(list: T[], key: (x: T) => number): T[] => [...list].sort((a, b) => key(a) - key(b));

/** The state with all but the newest `keep` finished items the model made dropped. Authored-by-person hidden arcs are never touched. */
export function prune(s: DirectorState, keep = DIRECTOR_FINISHED_KEEP): DirectorState {
  const paid = s.seeds.filter((x) => x.payoffDelivered);
  const finishedArcs = s.arcs.filter((a) => a.status === "complete" || a.status === "abandoned");
  const finishedHidden = s.invisibleArcs.filter((a) => (a.status === "resolved" || a.status === "visible") && !a.userAuthored);
  if (paid.length <= keep && finishedArcs.length <= keep && finishedHidden.length <= keep) return s;
  const drop = new Set<unknown>([
    ...oldestFirst(paid, (x) => x.payoffTurn ?? x.plantedAtTurn).slice(0, Math.max(0, paid.length - keep)),
    ...oldestFirst(finishedArcs, (a) => a.lastProgressTurn ?? a.createdAtTurn).slice(0, Math.max(0, finishedArcs.length - keep)),
    ...oldestFirst(finishedHidden, (a) => a.createdAtTurn).slice(0, Math.max(0, finishedHidden.length - keep)),
  ]);
  return { ...s, seeds: s.seeds.filter((x) => !drop.has(x)), arcs: s.arcs.filter((x) => !drop.has(x)), invisibleArcs: s.invisibleArcs.filter((x) => !drop.has(x)) };
}

const size = (s: DirectorState): number => JSON.stringify(s).length;

/** The state made to fit `max` serialized characters by giving up what is listed above; the same object when it already fits. */
export function fitState(s: DirectorState, max = DIRECTOR_STATE_BYTES_MAX): DirectorState {
  let n = size(s);
  if (n <= max) return s;
  let drop = 0;
  while (drop < s.activity.length && n > max) n -= JSON.stringify(s.activity[drop++]).length + 1;
  let out: DirectorState = { ...s, activity: s.activity.slice(drop) };
  const steps: ((x: DirectorState) => DirectorState)[] = [
    (x) => prune(x, 5),
    (x) => prune(x, 0),
    (x) => ({
      ...x,
      arcs: x.arcs.map((a) => ({ ...a, stages: a.stages.slice(-3) })), invisibleArcs: x.invisibleArcs.map((a) => ({ ...a, stages: a.stages.slice(-3), playerClues: a.playerClues.slice(-3) })),
      seeds: x.seeds.map((y) => ({ ...y, reinforcements: y.reinforcements.slice(-3) })), recentAnalysis: x.recentAnalysis.slice(-3),
    }),
    (x) => ({
      ...x,
      arcs: x.arcs.map((a) => ({ ...a, description: a.description.slice(0, 300), stages: a.stages.slice(-1) })), seeds: x.seeds.map((y) => ({ ...y, payoff: y.payoff.slice(0, 300), reinforcements: y.reinforcements.slice(-1) })),
      invisibleArcs: x.invisibleArcs.map((a) => (a.userAuthored ? a : { ...a, description: a.description.slice(0, 300), stages: a.stages.slice(-1), playerClues: a.playerClues.slice(-1), plannedBeats: [] })),
    }),
    (x) => ({
      ...x,
      arcs: oldestFirst(x.arcs, (a) => a.lastProgressTurn ?? a.createdAtTurn).slice(-WORKING_ARCS),
      seeds: oldestFirst(x.seeds, (y) => y.plantedAtTurn).slice(-WORKING_SEEDS),
      invisibleArcs: [...x.invisibleArcs.filter((a) => a.userAuthored), ...oldestFirst(x.invisibleArcs.filter((a) => !a.userAuthored), (a) => a.createdAtTurn).slice(-WORKING_HIDDEN)],
    }),
    (x) => ({ ...x, edits: (x.edits ?? []).slice(-10) }),
  ];
  for (const step of steps) {
    if (size(out) <= max) break;
    out = step(out);
  }
  return out;
}
