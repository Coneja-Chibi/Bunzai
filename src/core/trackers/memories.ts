/**
 * The Memories tracker, RoleCall's `memoryJournal` module (stores/immersion/memory-journal.ts, MemoryJournalWingPanel.tsx, the prompt line at
 * immersion-context.ts:512-527): what each NPC remembers of the player, by kind, weight and feeling. Pure: the panel computes the next state with `applyMemories` and
 * the scene keeps it (ChatStore rule 43). Memories come from Generate and Refresh, which only propose (generate.ts).
 *
 * Differences from RoleCall: Delete marks the memory and leaves an Undo; a full journal (300) refuses another where RoleCall drops the oldest.
 */
import { arr, num, obj, oneOf, opt, str, type Of } from "./shape";
import { repairOf, stateSpec } from "./state";
import { appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { entry, listOf, norm, sync, type RefreshSpec } from "./refresh";

export const CATEGORIES = ["interaction", "promise", "betrayal", "gift", "shared_experience", "observation"] as const;
export const WEIGHTS = ["trivial", "minor", "significant", "defining"] as const;
export const SENTIMENTS = ["positive", "negative", "neutral", "complex"] as const;
const MAX_MEMORIES = 300;

const fields = {
  npcName: str({ max: 80, min: 1 }),
  content: str({ max: 2000, min: 1 }),
  category: oneOf(CATEGORIES, "observation"),
  emotionalWeight: oneOf(WEIGHTS, "minor"),
  sentiment: oneOf(SENTIMENTS, "neutral"),
  linkedEventDescription: opt(str({ max: 500 })),
};
const memShape = obj({ ...fields, id: str({ max: 80, min: 1 }), timestamp: num({ lo: 0, hi: 1e15 }), removedAt: opt(num({ lo: 0, hi: 1e15 })) });
type Stored = Of<typeof memShape>;
export type Mem = Omit<Stored, "id" | "timestamp" | "removedAt">;
export interface Memories { memories: Stored[] }
export const DEFAULT_MEMORIES: Memories = { memories: [] };

/** The module's whole state, field by field: what a state passes, and what a slot holds one field or row of (state.ts). */
export const stateShape = obj({ memories: arr(memShape, MAX_MEMORIES * 2) });
export function parseMemories(data: unknown): Memories | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.memories) ? s : null;
}
/** What memories keeps in its slot (state.ts). */
export const MEMORIES_STATE = stateSpec(stateShape, { memories: "id" });
/** The module's one repair step (state.ts `repairOf`): every reader goes through `readMemories`, which uses it, so no read ever shows the defaults in place of a state it can mostly keep. Null: nothing is salvageable. */
export const repairMemories = repairOf(MEMORIES_STATE, DEFAULT_MEMORIES, parseMemories);
export const readMemories = (data: unknown): Memories => (data === undefined ? DEFAULT_MEMORIES : repairMemories(data) ?? DEFAULT_MEMORIES);
export const liveMemories = (m: Memories): Stored[] => liveOf(m.memories);
export const npcNames = (m: Memories): string[] => [...new Set(liveMemories(m).map((x) => x.npcName))].sort();

export type MemoriesAction =
  | { kind: "add"; memory: Mem; id: string; at: number }
  | { kind: "refresh"; id: string; memory: Mem }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string };

export function applyMemories(m: Memories, a: MemoriesAction): Memories {
  switch (a.kind) {
    case "add": {
      const memories = appendItem(m.memories, { ...a.memory, id: a.id, timestamp: a.at }, MAX_MEMORIES);
      return memories ? { memories } : m;
    }
    case "refresh": return { memories: patchItem(m.memories, a.id, (x) => ({ ...x, ...a.memory })) };
    case "remove": return find(m.memories, a.id) ? { memories: markRemoved(m.memories, a.id, a.at) } : m;
    case "restore": return { memories: unmarkRemoved(m.memories, a.id) };
  }
}

/** A memory's title, RoleCall's: the text before the first colon, else its first 60 characters. */
export const titleOf = (content: string): string => content.split(":")[0] || content.slice(0, 60);

/** The narrator's Memory Journal block (immersion-context.ts:512-527): the ten newest, titled. Nothing while the journal is empty. */
export function memoriesLines(m: Memories): string[] {
  const live = liveMemories(m);
  if (live.length === 0) return [];
  const recent = [...live].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  return [`**Memory Journal** (${live.length} total, showing ${recent.length} most recent \u2014 do NOT re-add these):\n${recent.map((x) => `- [${x.category}] ${titleOf(x.content)} (${x.npcName}, ${x.emotionalWeight})`).join("\n")}`];
}

/** RoleCall's schema text for a `memoryJournal` entry (generate-tracker-item/route.ts, moduleSchemas.memoryJournal). */
export const MEMORIES_GEN: GenSpec<Mem> = {
  description: () => "NPC memory entry - what an NPC remembers about the player",
  target: (name, noun) => `Generate a new ${noun} for NPC: "${name}". The "content" field must be a concrete memory grounded in the conversation or user guidance, not a placeholder.`,
  schema: () => `{
  "npcName": string,
  "content": string (what the NPC remembers),
  "category": "interaction" | "promise" | "betrayal" | "gift" | "shared_experience" | "observation",
  "emotionalWeight": "trivial" | "minor" | "significant" | "defining",
  "sentiment": "positive" | "negative" | "neutral" | "complex",
  "linkedEventDescription": string (optional, what event this memory relates to)
}`,
  item: obj(fields) as GenSpec<Mem>["item"],
};

const memoryKey = (x: { npcName: string; content: string }): string => `${norm(x.npcName)}|${norm(x.content).slice(0, 80)}`;

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.memoryJournal). A memory is known by who holds it and what it says. */
export const MEMORIES_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: (subs) => `Track what NPCs remember about the protagonist from their interactions. Return the memories that are still true as they stand.
Format: { "memories": [${MEMORIES_GEN.schema(subs)}] }`,
  rows: (d) => liveMemories(readMemories(d)).map((m) => ({ ...entry("memories", `${m.npcName}: ${titleOf(m.content)}`, MEMORIES_GEN.item.coerce(m) ?? m), key: memoryKey(m) })),
  next(d, a, env) {
    const made = listOf(a, "memories", MEMORIES_GEN.item, env);
    if (!made) return null;
    const m = readMemories(d);
    return sync(m, liveMemories(m), made, memoryKey, {
      refresh: (s, old, memory) => applyMemories(s, { kind: "refresh", id: old.id, memory }),
      add: (s, memory) => applyMemories(s, { kind: "add", memory, id: env.id(), at: env.now }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyMemories(s, { kind: "remove", id: old.id, at: env.now }),
    });
  },
};
