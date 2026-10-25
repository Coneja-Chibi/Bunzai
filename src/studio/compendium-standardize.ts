/**
 * Standardize runs (RoleCall `standardize/route.ts` and `lib/compendium/standardize.ts`, 04b D5): converts a book's classic entries
 * into typed entries in the background, in batches with bounded parallelism, through the one book writer (`compendium-standardize-batch.ts`).
 * A run is one in-process record per scene and book that the page polls: counts, a bounded log, and the state that locks the book's
 * edits while it works. The record is not the history; the receipts are (kind `standardize`), so a restart loses only the progress
 * display, and running it again simply continues with whatever is still classic. Cancel stops at the next safe point: model calls in
 * flight are aborted, a write already sent completes and is receipted, and nothing else is written. There is no stored lock to clear
 * (RoleCall's `Clear Lock` mends a database row that can outlive a crashed run; this lock lives only as long as the run does).
 */
import { toErrorMessage } from "../error-message";
import { canWrite, classicSources, isActive, makeBatches, resolveCompendium, type BatchPlan, type RunLine, type RunSnapshot, type StartRequest, type StdOutcome } from "../core/compendium";
import type { LorebookEntry } from "../entities/lorebook/schema";
import type { ChatConnection } from "../stage/contracts/chat-store";
import { runBatch } from "./compendium-standardize-batch";
import { sceneBooks, type CompendiumDeps } from "./compendium-deps";

export type StartResult = { ok: true; run: RunSnapshot; done: Promise<void> } | { ok: false; status: number; error: string };

interface Run { snap: RunSnapshot; abort: AbortController }

const runs = new Map<string, Run>();
const keyOf = (chatId: string, bookId: string): string => `${chatId}\u0000${bookId}`;
const LOG_MAX = 200;
const WARNINGS_MAX = 100;
export const TOKEN_BUDGET = { min: 1_000, max: 2_000_000, fallback: 100_000 } as const;

export const runOf = (chatId: string, bookId: string): RunSnapshot | null => { const r = runs.get(keyOf(chatId, bookId)); return r ? structuredClone(r.snap) : null; };
/** Whether any book of the scene is being standardized: its edits are paused. */
export const lockedBooks = (chatId: string): string[] => [...runs.values()].filter((r) => r.snap.chatId === chatId && isActive(r.snap)).map((r) => r.snap.bookId);
export const runsOf = (chatId: string): RunSnapshot[] => [...runs.values()].filter((r) => r.snap.chatId === chatId).map((r) => structuredClone(r.snap));

/** Stops a running run at the next safe point; a finished one is unchanged. */
export function cancelRun(chatId: string, bookId: string): RunSnapshot | null {
  const run = runs.get(keyOf(chatId, bookId));
  if (!run) return null;
  if (run.snap.status === "running") { run.snap.status = "cancelling"; run.abort.abort(); }
  return structuredClone(run.snap);
}

/** Forgets a finished run's summary (the card's DISMISS); a running one stays. */
export function dismissRun(chatId: string, bookId: string): boolean {
  const run = runs.get(keyOf(chatId, bookId));
  if (!run || isActive(run.snap)) return false;
  return runs.delete(keyOf(chatId, bookId));
}

const refuse = (status: number, error: string): StartResult => ({ ok: false, status, error });

export async function startStandardize(deps: CompendiumDeps, chatId: string, bookId: string, request: StartRequest): Promise<StartResult> {
  const held = runs.get(keyOf(chatId, bookId));
  if (held && isActive(held.snap)) return refuse(409, "Standardization is already running for this book.");
  const scene = await sceneBooks(deps, chatId);
  if (!scene) return refuse(404, "that scene is gone");
  const book = scene.books.find((b) => b.id === bookId);
  if (!book) return refuse(404, "that book is not one this scene reads");
  const settings = resolveCompendium(scene.chat.compendium);
  if (!settings.on) return refuse(409, "The Compendium is off for this scene. Turn it on in Settings to standardize.");
  if (!canWrite(book.access)) return refuse(409, "This book does not allow writing, so Compendium cannot standardize it. Allow writing from the access chip first.");
  // The sources are read the way the writer reads the book (not through the scene's projection), so "edited since the model saw it" compares like with like.
  const stored = await deps.store.read("lorebook", bookId);
  const sources = classicSources(stored?.kind === "lorebook" ? stored.body.entries : []);
  if (sources.length === 0) return refuse(409, "Nothing to standardize: every entry here is typed, retired or under Preserve.");
  const connection: ChatConnection | undefined = settings.standardize.modelSource === "compendium" ? settings.model ?? scene.chat.connection : scene.chat.connection;
  if (!connection) return refuse(409, "This scene has no model to standardize with. Pick one in the AI wing.");
  const connected = await deps.connect(connection);
  if (!connected) return refuse(409, "The model's connection is gone from Kit; pick another in the AI wing.");

  const plan: BatchPlan = request.by === "tokens"
    ? { by: "tokens", budget: Math.min(TOKEN_BUDGET.max, Math.max(TOKEN_BUDGET.min, Math.floor(request.tokenBudget ?? TOKEN_BUDGET.fallback))) }
    : { by: "entries", size: settings.standardize.batchSize };
  const batches = makeBatches(sources, plan);
  const snap: RunSnapshot = {
    chatId, bookId, status: "running", startedAt: deps.now(), model: connection.model, total: sources.length, processed: 0, rewritten: 0, consumed: 0, created: 0, dedup: 0, failed: 0,
    typed: {}, batches: { done: 0, total: batches.length }, warnings: [], log: [],
  };
  const run: Run = { snap, abort: new AbortController() };
  runs.set(keyOf(chatId, bookId), run);
  const log = (level: RunLine["level"], text: string): void => { snap.log.push({ at: deps.now(), level, text }); if (snap.log.length > LOG_MAX) snap.log.splice(0, snap.log.length - LOG_MAX); };
  log("info", `${sources.length} ${sources.length === 1 ? "entry" : "entries"} in ${batches.length} ${batches.length === 1 ? "batch" : "batches"}, ${Math.min(settings.standardize.parallelism, batches.length)} at a time, with ${connection.model}`);
  const landed = (outcomes: readonly StdOutcome[], typed: Readonly<Record<string, number>>): void => {
    for (const o of outcomes) {
      snap.processed += 1;
      if (o.result === "rewritten") snap.rewritten += 1;
      else if (o.result === "consumed") snap.consumed += 1;
      else {
        snap.failed += 1;
        if (snap.warnings.length < WARNINGS_MAX) snap.warnings.push(`${o.title}: ${o.reason ?? "left as written"}`);
      }
      snap.created += o.created;
      snap.dedup += o.dedup;
      if (o.result !== "failed" && o.reason && snap.warnings.length < WARNINGS_MAX) snap.warnings.push(`${o.title}: ${o.reason}`);
    }
    for (const [t, n] of Object.entries(typed)) snap.typed[t] = (snap.typed[t] ?? 0) + n;
  };

  const done = (async (): Promise<void> => {
    try {
      let next = 0;
      const worker = async (): Promise<void> => {
        while (!run.abort.signal.aborted) {
          const i = next++;
          const batch: LorebookEntry[] | undefined = batches[i];
          if (!batch) return;
          const label = `Batch ${i + 1}/${batches.length}`;
          snap.current = batch.map((e) => e.title || "(untitled)").slice(0, 3).join(", ") + (batch.length > 3 ? `, +${batch.length - 3} more` : "");
          try {
            await runBatch({ deps, chatId, branchId: scene.chat.activeBranchId, bookId, provider: connected.provider, model: connection.model, language: settings.language, maxRounds: settings.standardize.maxRounds, autoRetry: settings.standardize.autoRetry, signal: run.abort.signal, log, landed }, batch, label);
          } catch (error) {
            const why = toErrorMessage(error, "the batch failed");
            log("error", `${label}: ${why}`);
            landed(batch.map((e) => ({ entryId: e.id, title: e.title, result: "failed", reason: why, created: 0, dedup: 0 })), {});
          }
          snap.batches.done += 1;
        }
      };
      await Promise.all(Array.from({ length: Math.min(settings.standardize.parallelism, batches.length) }, worker));
      const stopped = run.abort.signal.aborted;
      const worked = snap.rewritten + snap.consumed + snap.created;
      snap.status = stopped ? "cancelled" : worked === 0 && snap.failed > 0 ? "failed" : "complete";
      if (snap.status === "failed") snap.error = `No entry could be converted. ${snap.warnings[0] ?? ""}`.trim();
      log(snap.status === "failed" ? "error" : "info", stopped ? "Stopped. Everything written so far is receipted." : `Finished: ${snap.rewritten} rewritten, ${snap.consumed} consumed, ${snap.created} new, ${snap.failed} left as written`);
    } catch (error) {
      snap.status = "failed";
      snap.error = toErrorMessage(error, "Standardization failed");
      log("error", snap.error);
    } finally {
      delete snap.current;
      snap.finishedAt = deps.now();
    }
  })();
  return { ok: true, run: structuredClone(snap), done };
}
