/**
 * The Knowledge tracker, RoleCall's `knowledge` module (stores/immersion/knowledge.ts, KnowledgeWingPanel.tsx, the prompt line at immersion-context.ts:343-350):
 * what the player has learned and how sure they are of it. Pure: the panel computes the next state with `applyKnowledge` and the scene keeps it (ChatStore
 * rule 43). Entries come from Generate and Refresh, which only propose (generate.ts).
 *
 * Differences from RoleCall, each deliberate: Delete marks the entry and leaves an Undo; a full list (300) refuses the new entry where
 * RoleCall drops the oldest; the de-duplication compares letters and digits of any script, where RoleCall's `[^a-z0-9]` reduces a subject written in another script
 * to nothing and so folds every such subject into the first; and an entry that says the same and more replaces the shorter one, where RoleCall's check drops it as
 * "essentially the same" (its longer-content branch is only reachable when neither text contains the other). Setting reliability and revealing the truth are the Story Director's (set_reliability, reveal_truth).
 */
import { arr, bool, dflt, num, obj, oneOf, opt, rec, str, type Of } from "./shape";
import { repairOf, stateSpec } from "./state";
import { appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { entry, listOf, sync, type RefreshSpec } from "./refresh";
import { subsKnown } from "./subfeatures";

export const RELIABILITIES = ["certain", "believes", "suspects", "uncertain", "wrong", "unknown"] as const;
export const CATEGORIES = ["person", "place", "event", "secret", "lore", "rumor", "fact"] as const;
export type Reliability = (typeof RELIABILITIES)[number];
export type KnowCategory = (typeof CATEGORIES)[number];

const MAX_ENTRIES = 300;

const text = (max: number, o: { min?: number; def?: string } = {}) => str({ max, ...o });
const fields = {
  subject: text(200, { min: 1 }),
  content: text(4000, { def: "" }),
  reliability: oneOf(RELIABILITIES, "uncertain"),
  category: oneOf(CATEGORIES, "fact"),
  source: opt(text(200)),
  secretType: opt(oneOf(["player_hiding", "npc_hiding"] as const)),
  hiddenFrom: opt(arr(text(80, { min: 1 }), 20)),
  concealmentMethod: opt(text(100)),
  vulnerabilityPoints: opt(arr(text(300, { min: 1 }), 20)),
  revelationImpact: opt(text(600)),
  dangerLevel: opt(oneOf(["minor", "major", "explosive"] as const)),
};
const entryShape = obj({
  ...fields,
  id: text(80, { min: 1 }),
  learnedAt: num({ lo: 0, hi: 1e15 }),
  learnedFrom: opt(text(200)),
  tags: opt(arr(text(60, { min: 1 }), 20)),
  linkedNpcNames: opt(arr(text(80, { min: 1 }), 20)),
  actuallyTrue: opt(bool()),
  dmNotes: opt(text(1000)),
  removedAt: opt(num({ lo: 0, hi: 1e15 })),
});
export type KnowEntry = Of<typeof entryShape>;
type Made = Omit<KnowEntry, "id" | "learnedAt">;

export interface Knowledge { entries: KnowEntry[]; subs: Record<string, boolean> }
export const DEFAULT_KNOWLEDGE: Knowledge = { entries: [], subs: {} };

/** The module's whole state, field by field: what a state passes, and what a slot holds one field or row of (state.ts). */
export const stateShape = obj({ entries: arr(entryShape, MAX_ENTRIES * 2), subs: dflt(rec(bool(), 4), {}) });

export function parseKnowledge(data: unknown): Knowledge | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.entries) && subsKnown("knowledge", s.subs) ? s : null;
}
/** What knowledge keeps in its slot (state.ts). */
export const KNOWLEDGE_STATE = stateSpec(stateShape, { entries: "id" });
/** The module's one repair step (state.ts `repairOf`): every reader goes through `readKnowledge`, which uses it, so no read ever shows the defaults in place of a state it can mostly keep. Null: nothing is salvageable. */
export const repairKnowledge = repairOf(KNOWLEDGE_STATE, DEFAULT_KNOWLEDGE, parseKnowledge);
export const readKnowledge = (data: unknown): Knowledge => (data === undefined ? DEFAULT_KNOWLEDGE : repairKnowledge(data) ?? DEFAULT_KNOWLEDGE);
export const liveEntries = (k: Knowledge): KnowEntry[] => liveOf(k.entries);
export const counts = (k: Knowledge) => {
  const live = liveEntries(k);
  return { all: live.length, certain: live.filter((e) => e.reliability === "certain").length, wrong: live.filter((e) => e.reliability === "wrong" || e.actuallyTrue === false).length, secrets: live.filter((e) => e.secretType !== undefined).length };
};

export type KnowledgeAction =
  | { kind: "add"; entry: Made; id: string; at: number }
  | { kind: "refresh"; id: string; entry: Made }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string };

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const RANK: Readonly<Record<Reliability, number>> = { certain: 4, believes: 3, suspects: 2, uncertain: 1, unknown: 0, wrong: -1 };

/** One panel action, as RoleCall's store does it (knowledge.ts:83-140), returning the next state; the same state when the action changes nothing. */
export function applyKnowledge(k: Knowledge, a: KnowledgeAction): Knowledge {
  switch (a.kind) {
    case "add": {
      const same = liveEntries(k).find((e) => norm(e.subject) === norm(a.entry.subject));
      if (same) {
        const have = norm(same.content), want = norm(a.entry.content);
        if (have === want || have.includes(want)) return k;
        const longer = a.entry.content.length > same.content.length;
        const surer = RANK[a.entry.reliability] > RANK[same.reliability];
        if (!longer && !surer) return k;
        return { ...k, entries: patchItem(k.entries, same.id, (e) => ({ ...e, ...(longer ? { content: a.entry.content } : {}), ...(surer ? { reliability: a.entry.reliability } : {}) })) };
      }
      const entries = appendItem(k.entries, { ...a.entry, id: a.id, learnedAt: a.at }, MAX_ENTRIES);
      return entries ? { ...k, entries } : k;
    }
    case "refresh": return { ...k, entries: patchItem(k.entries, a.id, (e) => ({ ...e, ...a.entry })) };
    case "remove": return find(k.entries, a.id) ? { ...k, entries: markRemoved(k.entries, a.id, a.at) } : k;
    case "restore": return { ...k, entries: unmarkRemoved(k.entries, a.id) };
  }
}

/** The narrator's Knowledge line (immersion-context.ts:343-350): how many entries, and the newest subject. Nothing when there are none. */
export function knowledgeLines(k: Knowledge): string[] {
  const live = liveEntries(k);
  if (live.length === 0) return [];
  const newest = live.reduce((best, e) => (e.learnedAt > best.learnedAt ? e : best));
  return [`**Knowledge**: ${live.length} entries | Recent: "${newest.subject}"`];
}

/** RoleCall's schema text for a `knowledge` entry (generate-tracker-item/route.ts, moduleSchemas.knowledge); the secret fields only with the Secrets sub-feature. */
export const KNOWLEDGE_GEN: GenSpec<Made> = {
  description: () => "Knowledge entry",
  schema: (subs) => `{
  "subject": string,
  "content": string,
  "reliability": "certain" | "believes" | "suspects" | "uncertain" | "wrong",
  "category": "person" | "place" | "event" | "secret" | "lore" | "rumor" | "fact",
  "source": string${subs["secrets"] ? `,
  "secretType": "player_hiding" | "npc_hiding",
  "hiddenFrom": [string],
  "concealmentMethod": "lying" | "omission" | "misdirection",
  "vulnerabilityPoints": [string],
  "revelationImpact": string,
  "dangerLevel": "minor" | "major" | "explosive"` : ""}
}`,
  item: obj(fields) as GenSpec<Made>["item"],
};

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.knowledge). */
export const KNOWLEDGE_REFRESH: RefreshSpec = {
  maxTokens: 6000,
  instruction: (subs) => `Extract facts, rumors, secrets, or beliefs the protagonist has learned. Note reliability.
Format: { "entries": [${KNOWLEDGE_GEN.schema(subs)}] }${subs["secrets"] ? `
Additionally, for secrets specifically, include: "secretType": "player_hiding"|"npc_hiding" (who is concealing), "hiddenFrom": [string] (character names), "concealmentMethod": "lying"|"omission"|"misdirection", "vulnerabilityPoints": [string] (how it might slip), "revelationImpact": string (consequences), "dangerLevel": "minor"|"major"|"explosive". Mark knowledge entries that are secrets with these extra fields.` : ""}`,
  rows: (d) => liveEntries(readKnowledge(d)).map((e) => entry("entries", e.subject, KNOWLEDGE_GEN.item.coerce(e) ?? e)),
  next(d, a, env) {
    const made = listOf(a, "entries", KNOWLEDGE_GEN.item, env);
    if (!made) return null;
    const k = readKnowledge(d);
    const name = (x: { subject: string }): string => norm(x.subject);
    return sync(k, liveEntries(k), made, name, {
      refresh: (s, old, entry) => applyKnowledge(s, { kind: "refresh", id: old.id, entry }),
      add: (s, entry) => applyKnowledge(s, { kind: "add", entry, id: env.id(), at: env.now }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyKnowledge(s, { kind: "remove", id: old.id, at: env.now }),
    });
  },
};
