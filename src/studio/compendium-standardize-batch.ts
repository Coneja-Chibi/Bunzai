/**
 * One Standardize batch (04b D5, F13): ask the model for the batch's entries as one JSON answer, ask again for the entries it left
 * out (each ask is a round, at most the Tool Loop Cap; one repair call per round for an answer that does not read), ask once more for
 * the entries that came back unusable when "Auto-retry failed entries once" is on, then write what came back as receipted,
 * revision-checked patches through the one book writer. Nothing is written for an entry the model never answered, and a batch that
 * is cancelled before its write writes nothing. Entries that fail stay classic with their reason, so a later run picks them up.
 * No entry text is logged (F12): the live log carries titles and counts.
 */
import { toErrorMessage } from "../error-message";
import { repairMessages, stageStandardize, standardizeMessages, parseStandardizeAnswer, STANDARDIZE_TYPES, type StdOutcome, type StdSource } from "../core/compendium";
import { splitReasoning } from "../core/reasoning-tags";
import type { LorebookEntry } from "../entities/lorebook/schema";
import type { Provider } from "../stage/contracts/provider";
import type { CompendiumDeps } from "./compendium-deps";
import { commitStaged, RECEIPT_BUDGET } from "./compendium-commit";

const MODEL_OPTIONS = { temperature: 0.2, max_tokens: 8192 } as const;

/** What a batch needs of its run: the model, the knobs, the scene, and where to report. */
export interface BatchContext {
  deps: CompendiumDeps;
  chatId: string;
  branchId: string;
  bookId: string;
  provider: Provider;
  model: string;
  language: string;
  maxRounds: number;
  autoRetry: boolean;
  signal: AbortSignal;
  log(level: "info" | "warn" | "error", text: string): void;
  /** Reports the outcomes of one receipt's worth of sources. */
  landed(outcomes: readonly StdOutcome[], typed: Readonly<Record<string, number>>): void;
}

async function ask(c: BatchContext, batch: readonly LorebookEntry[], numbers: readonly number[], got: Map<number, { items: StdSource["items"]; notes: string[] }>): Promise<boolean> {
  const first = standardizeMessages({ sources: numbers.map((n) => ({ entry: batch[n - 1]!, number: n })), language: c.language });
  const send = async (m: { system: string; user: string }): Promise<string> => {
    const done = await c.provider.send({ model: c.model, messages: [{ role: "system", content: m.system }, { role: "user", content: m.user }], options: { ...MODEL_OPTIONS } }, { signal: c.signal });
    return splitReasoning(done.content).reply;
  };
  let text = await send(first);
  let parsed = parseStandardizeAnswer(text, batch.length, STANDARDIZE_TYPES);
  if (!parsed.ok) {
    c.log("warn", `The answer did not read (${parsed.error}); asking once more`);
    text = await send(repairMessages(first, text, parsed.error));
    parsed = parseStandardizeAnswer(text, batch.length, STANDARDIZE_TYPES);
  }
  if (!parsed.ok) { c.log("warn", `The answer still did not read: ${parsed.error}`); return false; }
  for (const s of parsed.stray) c.log("warn", s);
  let progress = false;
  for (const a of parsed.answers) {
    if (!numbers.includes(a.number)) continue;
    got.set(a.number, { items: a.items, notes: a.rejected.map((r) => `item ${r.position}: ${r.reason}`) });
    progress = true;
  }
  return progress;
}

/** Writes the sources as receipted patches, one receipt per fit; returns once every source has an outcome or the run was stopped. */
const commit = (c: BatchContext, sources: readonly StdSource[], model: string): Promise<void> =>
  commitStaged(c, {
    kind: "standardize", done: "converted", lost: "These entries were written but their receipt could not be saved, so Revert cannot restore them",
    stage: (entries, queue, receiptId) => stageStandardize(entries, queue, { bookId: c.bookId, receiptId, newId: c.deps.newId, now: c.deps.now(), budgetBytes: RECEIPT_BUDGET }),
  }, sources, model);

export async function runBatch(c: BatchContext, batch: readonly LorebookEntry[], label: string): Promise<void> {
  const got = new Map<number, { items: StdSource["items"]; notes: string[] }>();
  const numbers = batch.map((_, i) => i + 1);
  let lastError = "";
  const attempt = async (wanted: readonly number[]): Promise<boolean> => {
    try {
      return await ask(c, batch, wanted, got);
    } catch (error) {
      if (c.signal.aborted) return false;
      lastError = toErrorMessage(error, "the model did not answer");
      c.log("error", `${label}: ${lastError}`);
      return false;
    }
  };
  for (let round = 1; round <= c.maxRounds && !c.signal.aborted; round++) {
    const pending = numbers.filter((n) => !got.has(n));
    if (pending.length === 0) break;
    c.log("info", `${label}: round ${round}, asking about ${pending.length} ${pending.length === 1 ? "entry" : "entries"}`);
    if (!(await attempt(pending))) break;
  }
  if (c.autoRetry && !c.signal.aborted) {
    const bad = numbers.filter((n) => (got.get(n)?.items.length ?? 0) === 0);
    if (bad.length > 0) {
      c.log("info", `${label}: trying ${bad.length} ${bad.length === 1 ? "entry" : "entries"} once more`);
      await attempt(bad);
    }
  }
  if (c.signal.aborted) return;
  const sources = batch.map((entry, i): StdSource => {
    const answer = got.get(i + 1);
    return { entry, items: answer?.items ?? [], notes: answer?.notes ?? [lastError ? `the model did not answer: ${lastError}` : "the model gave no answer for it"] };
  });
  // An entry the model gave nothing usable for needs no receipt: nothing was written for it.
  const empty = sources.filter((s) => s.items.length === 0);
  if (empty.length > 0) c.landed(empty.map((s) => ({ entryId: s.entry.id, title: s.entry.title, result: "failed", reason: s.notes.join("; "), created: 0, dedup: 0 })), {});
  await commit(c, sources.filter((s) => s.items.length > 0), c.model);
}
