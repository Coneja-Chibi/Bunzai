/**
 * "Refine entries during build" (RoleCall `tv-tree-llm.ts` Phase 4, 04b Track D3): once a tree build has sorted the book, the model
 * reviews each branch that has no branch below it and may split an entry that covers several topics and merge entries that say the
 * same thing. The splits and merges are Standardize's: the same working book, receipt budget, revision-checked writer and commit
 * loop (`compendium-commit.ts`), so a split is a new entry, a merge retires the entry it absorbs and never deletes it, and every
 * write is in a receipt (kind `refine`, Activity's "Merged/Split") that Undo takes back. Only live classic entries take part:
 * typed ones keep their data as the authority, Preserve is honoured (checked again as each change is staged), and an entry the
 * person locked or forbade, or sits under a locked branch, is left alone. A branch is cut so one call carries about
 * `CHUNK_TOKENS` of entry text, three calls at once, one JSON answer and at most one repair each (F13). Nothing here ends a build:
 * any failure comes back as a note and the layout the build made is kept as it was. Callers run it in the scene's lane.
 */
import { toErrorMessage } from "../error-message";
import { applyRefined, makeBatches, parseRefineAnswer, refineBlock, refineMessages, repairMessages, stageRefine, type RefineSource, type StdOutcome } from "../core/compendium";
import type { LorebookEntry } from "../entities/lorebook/schema";
import { entityRevision } from "../kit/changes/revision";
import type { ChatCompendiumTreeConstraints } from "../stage/contracts/chat-settings-types";
import type { LayoutNode, StoredLayout } from "../stage/contracts/chat-tree-types";
import { askJson, type Ask } from "./compendium-ask";
import { commitStaged, RECEIPT_BUDGET } from "./compendium-commit";
import type { CompendiumDeps } from "./compendium-deps";
import type { Connected } from "./scene-turn";

/** RoleCall: three branches at once, a cool temperature, 4000 tokens for the answer. */
const PARALLEL = 3;
const OPTIONS = { temperature: 0.2, max_tokens: 4000 } as const;
/** About how much entry text one call carries; a branch with more is cut into several, so a merge needs both entries in one cut. */
const CHUNK_TOKENS = 12_000;

export interface RefineInput {
  deps: CompendiumDeps;
  chatId: string;
  branchId: string;
  bookId: string;
  connected: Connected;
  model: string;
  language: string;
  signal?: AbortSignal;
  /** The layout the build made and the book's entries as it read them. */
  layout: StoredLayout;
  entries: readonly LorebookEntry[];
  constraints: ChatCompendiumTreeConstraints;
}

export interface RefineResult { layout: StoredLayout; notes: string[] }

interface Chunk { label: string; entries: LorebookEntry[] }

/** The branches that have nothing below them, with the entries of each that may be refined, cut to what one call carries. */
function chunksOf(input: RefineInput): Chunk[] {
  const byId = new Map(input.entries.map((e) => [e.id, e]));
  const hands = new Set([...(input.constraints.locked ?? []), ...(input.constraints.forbidden ?? [])]);
  const out: Chunk[] = [];
  const visit = (n: LayoutNode, held: boolean): void => {
    const locked = held || hands.has(n.id);
    if (n.children.length > 0) return n.children.forEach((k) => visit(k, locked));
    if (locked) return;
    const mine = n.entryIds.flatMap((id) => { const e = byId.get(id); return e && !hands.has(id) && refineBlock(e) === null ? [e] : []; });
    for (const part of makeBatches(mine, { by: "tokens", budget: CHUNK_TOKENS })) if (part.length >= 2) out.push({ label: n.label, entries: part });
  };
  input.layout.root.children.forEach((k) => visit(k, false));
  return out;
}

/** Runs `tasks` with at most `width` in flight, keeping each result at its own position. */
async function inPool<T>(tasks: readonly (() => Promise<T>)[], width: number): Promise<T[]> {
  const out: T[] = new Array<T>(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, tasks.length) }, async () => {
    while (next < tasks.length) { const at = next++; out[at] = await tasks[at]!(); }
  }));
  return out;
}

export async function refineBuilt(input: RefineInput): Promise<RefineResult> {
  const { deps, signal } = input;
  const notes: string[] = [];
  const kept: RefineResult = { layout: input.layout, notes };
  const chunks = chunksOf(input);
  if (chunks.length === 0) return { ...kept, notes: ["Refine: no branch had two entries it could review"] };
  const ask: Ask = { model: input.model, options: { ...OPTIONS }, ...(signal ? { signal } : {}) };

  const found = await inPool(chunks.map((chunk) => async (): Promise<RefineSource[]> => {
    if (signal?.aborted) return [];
    try {
      const parsed = await askJson(input.connected, ask, refineMessages({ label: chunk.label, entries: chunk.entries, language: input.language }), (text) => { const p = parseRefineAnswer(text, chunk.entries.length); return p.ok ? { ok: true, value: p } : p; }, repairMessages);
      if (!parsed.ok) { notes.push(`Refine: "${chunk.label}" could not be reviewed: ${parsed.error}`); return []; }
      for (const n of parsed.value.notes) notes.push(`Refine, "${chunk.label}": ${n}`);
      return parsed.value.ops.map((op): RefineSource => op.kind === "merge" ? { entry: chunk.entries[op.keep]!, other: chunk.entries[op.remove]!, op } : { entry: chunk.entries[op.at]!, op });
    } catch (error) {
      if (!signal?.aborted) notes.push(`Refine: "${chunk.label}" failed: ${toErrorMessage(error, "the model did not answer")}`);
      return [];
    }
  }), PARALLEL);
  const sources = found.flat();
  if (signal?.aborted) return kept;
  if (sources.length === 0) { notes.push("Refine: nothing to split or merge"); return kept; }

  const outcomes: StdOutcome[] = [];
  try {
    await commitStaged({
      deps, chatId: input.chatId, branchId: input.branchId, bookId: input.bookId, signal: signal ?? new AbortController().signal,
      log: (_level, text) => void notes.push(`Refine: ${text}`),
      landed: (o) => void outcomes.push(...o),
    }, {
      kind: "refine", done: "refined", lost: "These entries were refined but their receipt could not be saved, so Undo cannot restore them",
      stage: (entries, queue, receiptId) => stageRefine(entries, queue, { bookId: input.bookId, receiptId, newId: deps.newId, now: deps.now(), budgetBytes: RECEIPT_BUDGET }),
    }, sources, input.model);
  } catch (error) {
    notes.push(`Refine failed: ${toErrorMessage(error, "the book could not be written")}`);
    return kept;
  }

  const done = outcomes.filter((o) => o.result !== "failed");
  const left = outcomes.filter((o) => o.result === "failed");
  const splits = done.reduce((n, o) => n + (o.made?.length ?? 0), 0);
  const merges = done.filter((o) => o.result === "consumed").length;
  notes.push(`Refine: ${splits} split, ${merges} merged${left.length > 0 ? `, ${left.length} left as written: ${left.slice(0, 5).map((o) => `${o.title} (${o.reason})`).join("; ")}` : ""}`);
  if (splits + merges === 0) return kept;
  const book = await deps.store.read("lorebook", input.bookId);
  if (book?.kind !== "lorebook") return kept;
  const made = new Map(done.flatMap((o) => (o.made ?? []).map((id): [string, string] => [id, o.entryId])));
  return { layout: applyRefined(input.layout, made, new Set(done.filter((o) => o.result === "consumed").map((o) => o.entryId)), entityRevision(book)), notes };
}
