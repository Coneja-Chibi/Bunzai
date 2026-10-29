/**
 * The Corruption tracker, RoleCall's `corruption` module (stores/immersion/corruption.ts, CorruptionWingPanel.tsx, the prompt line at immersion-context.ts:233-246):
 * five metrics for the player (corruption, submission, dependence, obsession, identity loss), the NPCs who are being changed and the history of the player's
 * changes. Pure: the panel computes the next state with `applyCorruption` and the scene keeps it (ChatStore rule 43). NPC entries come from Generate and Refresh,
 * which only propose (generate.ts).
 *
 * The overall level, the dominant metric and each metric's effects follow from the five values, so only the values are kept; RoleCall stores the results as well and
 * recomputes them on every change. Differences from RoleCall: Delete on an NPC marks it and leaves an Undo. RoleCall's narrator line names only
 * the player, so what the NPC entries hold never reaches the narrator; that is kept as it is and flagged, not widened.
 */
import { arr, num, obj, oneOf, opt, str, type Of } from "./shape";
import { repairOf, stateSpec } from "./state";
import { appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, sameName, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { single, type RefreshSpec } from "./refresh";

export const METRICS = ["corruption", "submission", "dependence", "obsession", "identityLoss"] as const;
export type Metric = (typeof METRICS)[number];
export type Level = "pure" | "tainted" | "corrupted" | "fallen" | "lost";
export const METRIC_NAMES: Readonly<Record<Metric, string>> = { corruption: "Corruption", submission: "Submission", dependence: "Dependence", obsession: "Obsession", identityLoss: "Identity Loss" };
/** RoleCall's thresholds, drawn as marks on each bar (corruption.ts createInitialMetric). */
export const THRESHOLDS = [25, 50, 75] as const;

const LOG_MAX = 50, NPC_MAX = 100;
const percent = num({ lo: 0, hi: 100, int: true, def: 0 });
const metrics = { corruption: percent, submission: percent, dependence: percent, obsession: percent, identityLoss: percent };
const npcFields = { npcName: str({ max: 80, min: 1 }), ...metrics, cause: str({ max: 300, def: "Unknown" }), effects: opt(arr(str({ max: 200, min: 1 }), 20)), description: opt(str({ max: 1000 })) };
const npcShape = obj({ ...npcFields, id: str({ max: 80, min: 1 }), removedAt: opt(num({ lo: 0, hi: 1e15 })) });
export type Npc = Of<typeof npcShape>;
type Made = Omit<Npc, "id" | "removedAt">;
const logShape = obj({ id: str({ max: 80, min: 1 }), metric: oneOf([...METRICS, "all"] as const), delta: num({ lo: -100, hi: 100 }), reason: str({ max: 200 }), at: num({ lo: 0, hi: 1e15 }) });
export type LogEntry = Of<typeof logShape>;

export interface Corruption { values: Record<Metric, number>; log: LogEntry[]; npcs: Npc[] }
export const DEFAULT_CORRUPTION: Corruption = { values: { corruption: 0, submission: 0, dependence: 0, obsession: 0, identityLoss: 0 }, log: [], npcs: [] };

/** The module's whole state, field by field: what a state passes, and what a slot holds one field or row of (state.ts). */
export const stateShape = obj({ values: obj(metrics), log: arr(logShape, LOG_MAX), npcs: arr(npcShape, NPC_MAX * 2) });
export function parseCorruption(data: unknown): Corruption | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.npcs) && hasUniqueIds(s.log) ? s : null;
}
/** What corruption keeps in its slot (state.ts). */
export const CORRUPTION_STATE = stateSpec(stateShape, { npcs: "id" });
/** The module's one repair step (state.ts `repairOf`): every reader goes through `readCorruption`, which uses it, so no read ever shows the defaults in place of a state it can mostly keep. Null: nothing is salvageable. */
export const repairCorruption = repairOf(CORRUPTION_STATE, DEFAULT_CORRUPTION, parseCorruption);
export const readCorruption = (data: unknown): Corruption => (data === undefined ? DEFAULT_CORRUPTION : repairCorruption(data) ?? DEFAULT_CORRUPTION);
export const liveNpcs = (c: Corruption): Npc[] => liveOf(c.npcs);

/** The overall state from the average of the five values (corruption.ts:20-26). */
export function overallLevel(v: Record<Metric, number>): Level {
  const avg = METRICS.reduce((sum, m) => sum + v[m], 0) / METRICS.length;
  return avg >= 80 ? "lost" : avg >= 60 ? "fallen" : avg >= 40 ? "corrupted" : avg >= 20 ? "tainted" : "pure";
}
/** The highest metric, or none while the highest is under 20 (corruption.ts:28-39). */
export function dominantMetric(v: Record<Metric, number>): Metric | undefined {
  const top = METRICS.reduce((best, m) => (v[m] > v[best] ? m : best), METRICS[0]);
  return v[top] < 20 ? undefined : top;
}
/** What a value brings (corruption.ts:41-47), named for its metric. */
export function effectsFor(value: number, name: string): string[] {
  return [value >= 25 ? `Minor ${name} influence` : "", value >= 50 ? `Moderate ${name} compulsion` : "", value >= 75 ? `Severe ${name} domination` : "", value >= 90 ? `Complete ${name} surrender` : ""].filter(Boolean);
}
export const activeEffects = (v: Record<Metric, number>): string[] => METRICS.flatMap((m) => effectsFor(v[m], METRIC_NAMES[m]));
export const LEVEL_LABEL: Readonly<Record<Level, string>> = { pure: "Pure", tainted: "Tainted", corrupted: "Corrupted", fallen: "Fallen", lost: "Lost" };

export type CorruptionAction =
  | { kind: "change"; metric: Metric; delta: number; at: number; id: string }
  | { kind: "npcAdd"; npc: Made; id: string }
  | { kind: "npcRefresh"; id: string; npc: Made }
  | { kind: "npcChange"; id: string; metric: Metric; delta: number }
  | { kind: "npcRemove"; id: string; at: number }
  | { kind: "npcRestore"; id: string };

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

/** One panel action, as RoleCall's store does it (corruption.ts:changeMetric, addNpcCorruption, updateNpcCorruption, changeNpcMetric), returning the next state. */
export function applyCorruption(c: Corruption, a: CorruptionAction): Corruption {
  switch (a.kind) {
    case "change": {
      const log: LogEntry = { id: a.id, metric: a.metric, delta: a.delta, reason: `${a.metric} ${a.delta > 0 ? "increased" : "decreased"}`, at: a.at };
      return { ...c, values: { ...c.values, [a.metric]: clamp(c.values[a.metric] + a.delta) }, log: [log, ...c.log].slice(0, LOG_MAX) };
    }
    case "npcAdd": {
      const same = liveNpcs(c).find((n) => sameName(n.npcName, a.npc.npcName));
      if (same) return { ...c, npcs: patchItem(c.npcs, same.id, (n) => ({ ...n, ...a.npc, npcName: n.npcName })) };
      const npcs = appendItem(c.npcs, { ...a.npc, id: a.id }, NPC_MAX);
      return npcs ? { ...c, npcs } : c;
    }
    case "npcRefresh": return { ...c, npcs: patchItem(c.npcs, a.id, (n) => ({ ...n, ...a.npc })) };
    case "npcChange": return { ...c, npcs: patchItem(c.npcs, a.id, (n) => ({ ...n, [a.metric]: clamp(n[a.metric] + a.delta) })) };
    case "npcRemove": return find(c.npcs, a.id) ? { ...c, npcs: markRemoved(c.npcs, a.id, a.at) } : c;
    case "npcRestore": return { ...c, npcs: unmarkRemoved(c.npcs, a.id) };
  }
}

/** The narrator's Corruption line (immersion-context.ts:233-246): the overall state and the player's metrics above 0. Nothing while pure. */
export function corruptionLines(c: Corruption): string[] {
  const level = overallLevel(c.values);
  if (level === "pure") return [];
  const parts = METRICS.filter((m) => c.values[m] > 0).map((m) => `${m} ${c.values[m]}`);
  return [`**Corruption**: ${LEVEL_LABEL[level]} (${parts.join(", ")})`];
}

/** RoleCall's schema text for a `corruption` entry (generate-tracker-item/route.ts, moduleSchemas.corruption). */
export const CORRUPTION_GEN: GenSpec<Made> = {
  description: () => "NPC corruption entry",
  schema: () => `{
  "npcName": string,
  "corruption": number,
  "submission": number,
  "dependence": number,
  "obsession": number,
  "identityLoss": number,
  "cause": string,
  "effects": [string],
  "description": string
}`,
  item: obj(npcFields) as GenSpec<Made>["item"],
};

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.corruption): the player's five metrics. NPC entries are refreshed one at a time. */
export const CORRUPTION_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: () => `If applicable, assess any corruption, submission, dependence, obsession, or identity loss metrics (0-100 each, 0=pure). Be conservative with corruption metrics - most characters start at 0 unless the story suggests otherwise.
Format: { "corruption": number, "submission": number, "dependence": number, "obsession": number, "identityLoss": number }`,
  rows: (d) => METRICS.map((m) => single(m, METRIC_NAMES[m], readCorruption(d).values[m])),
  next(d, a) {
    const c = readCorruption(d);
    const read = METRICS.map((m) => [m, percent.coerce(a[m])] as const).filter(([k, v]) => v !== null && a[k] !== undefined);
    return read.length === 0 ? null : { ...c, values: { ...c.values, ...Object.fromEntries(read) } };
  },
};
