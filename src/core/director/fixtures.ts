/**
 * Small builders for Director tests: a state, an arc, a seed and a hidden arc with every required field, so a test names only what it is about.
 */
import type { DirectorArc, DirectorInvisibleArc, DirectorSeed, DirectorState } from "../../stage/contracts/director-types";
import { emptyDirectorState } from "./state";

export const arcOf = (over: Partial<DirectorArc> = {}): DirectorArc => ({
  id: "arc-1", title: "The Locked Room", description: "A door nobody opens.", status: "building", priority: "active", arcType: "side", horizon: "medium", scope: "player",
  turnsActive: 0, involvedCharacters: [], stages: [], createdAtTurn: 1, ...over,
});
export const seedOf = (over: Partial<DirectorSeed> = {}): DirectorSeed => ({
  id: "seed-1", hint: "A cracked bell", payoff: "It rings at the finale.", scope: "world", plantedAtTurn: 1, payoffHorizon: "long", turnsActive: 0, payoffDelivered: false, reinforcements: [], ...over,
});
export const hiddenOf = (over: Partial<DirectorInvisibleArc> = {}): DirectorInvisibleArc => ({
  id: "hid-1", title: "The Ledger Conspiracy", description: "Someone is cooking the books.", arcType: "conspiracy", horizon: "medium", scope: "world", status: "building", turnsActive: 0,
  plannedBeats: [], stages: [], relatedVisibleArcs: [], foreshadowingSeeds: [], playerClues: [], createdAtTurn: 1, ...over,
});
export const stateOf = (over: Partial<DirectorState> = {}): DirectorState => ({ ...emptyDirectorState(), ...over });
