/**
 * Import chat history (04b Track D; RoleCall `lib/lorebook/tv-ingest.ts`, Settings "Import chat history"): a run reads a range of a
 * scene's live messages as they stream past, cuts them into chunks of about `chunkTokens`, and for each chunk asks the model once
 * (one JSON answer, one repair) what to file, then writes it through the one book writer as one revision-checked patch with an
 * `ingest` receipt. The transcript is never held whole (one page and one chunk at a time), a run is cancelled between chunks or
 * mid-call, a chunk that cannot be read files nothing and the run goes on, and a chunk takes the scene's lane only for its one
 * patch, so a reply, a filing or an Undo is never held up for a model call. One run per scene at a time; its state is kept in this
 * process for the page to poll. Nothing is logged but counts (F12).
 */
import { toErrorMessage } from "../error-message";
import { activityLine, buildSnapshot, createChunker, ingestAllowed, ingestMessages, parseHistorian, resolveCompendium, writeBookOf, type Window } from "../core/compendium";
import type { CompendiumReceipt, Message } from "../stage/contracts/chat-store";
import { ProviderError } from "../stage/contracts/provider";
import { StudioConflictError } from "./atomic-file";
import { askJson } from "./compendium-ask";
import { sceneBooks, type CompendiumDeps } from "./compendium-deps";
import { enqueue } from "./compendium-queue";
import { writeRecaps } from "./compendium-recap-write";
import { undoAll } from "./compendium-undo";
import { StudioNotFoundError } from "./errors";
import { selectedGuides } from "./guides";

export interface IngestLine { chunk: number; from: number; to: number; status: CompendiumReceipt["status"]; created: number; updated: number; reason?: string; receiptId: string }

export interface IngestRun {
  id: string;
  chatId: string;
  bookId: string;
  from: number;
  to: number;
  status: "running" | "done" | "cancelled" | "failed";
  /** The live message index the run has read up to (exclusive). */
  at: number;
  lines: IngestLine[];
  /** Why the run stopped early, or the errors of chunks that could not be filed. */
  errors: string[];
}

const PAGE = 100;
const MODEL_OPTIONS = { temperature: 0.3, max_tokens: 4096 } as const;
const runs = new Map<string, IngestRun>();
const aborts = new Map<string, AbortController>();

export const latestRun = (chatId: string): IngestRun | null => runs.get(chatId) ?? null;

export function cancelIngest(chatId: string, runId: string): boolean {
  const run = runs.get(chatId);
  if (!run || run.id !== runId || run.status !== "running") return false;
  aborts.get(chatId)?.abort();
  return true;
}

/** Validates, then starts a run in the background and answers its starting state; the work goes on after this returns. */
export async function startIngest(deps: CompendiumDeps, p: { chatId: string; bookId: string; from: number; to: number }): Promise<IngestRun> {
  if (runs.get(p.chatId)?.status === "running") throw new StudioConflictError("an ingest is already running for this scene");
  const scene = await sceneBooks(deps, p.chatId);
  if (!scene) throw new StudioNotFoundError("that scene is gone");
  const book = scene.books.find((b) => b.id === p.bookId);
  if (!book) throw new StudioNotFoundError("that book is not one this scene reads");
  if (!book.writable) throw new StudioConflictError(`"${book.name}" does not allow the Compendium to write; give it write access in Settings`);
  const settings = resolveCompendium(scene.chat.compendium);
  if (ingestAllowed(settings.ingest).length === 0) throw new StudioConflictError("switch on Facts or Narrative to ingest");
  const connection = settings.ingest.model === "scene" ? scene.chat.connection : settings.model ?? scene.chat.connection;
  if (!connection) throw new StudioConflictError("this scene has no connection to ingest with");
  const connected = await deps.connect(connection);
  if (!connected) throw new StudioConflictError("the connection is gone from Kit");
  const total = await deps.chats.countMessages(scene.chat.activeBranchId);
  if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < 0 || p.to > total || p.from >= p.to) throw new StudioConflictError(`pick a range inside the ${total} messages, with From before To`);

  const run: IngestRun = { id: deps.newId(), chatId: p.chatId, bookId: p.bookId, from: p.from, to: p.to, status: "running", at: p.from, lines: [], errors: [] };
  runs.set(p.chatId, run);
  const abort = new AbortController();
  aborts.set(p.chatId, abort);
  const branchId = scene.chat.activeBranchId;
  void drive(deps, run, branchId, abort.signal).then(() => undefined, (e: unknown) => {
    run.status = "failed";
    run.errors.push(toErrorMessage(e, "the ingest failed"));
  }).finally(() => { if (aborts.get(p.chatId) === abort) aborts.delete(p.chatId); });
  return run;
}

async function drive(deps: CompendiumDeps, run: IngestRun, branchId: string, signal: AbortSignal): Promise<void> {
  const settings = resolveCompendium((await deps.chats.getChat(run.chatId))?.compendium);
  const chunker = createChunker(settings.ingest.chunkTokens);
  const activity: string[] = [];
  let index = 0;
  let chunkFrom = run.from;
  let n = 0;
  const file = async (chunk: string, from: number, to: number): Promise<void> => {
    n += 1;
    const line = await ingestChunk(deps, run, branchId, chunk, from, to, n, activity, signal);
    run.lines.push(line);
    if (line.status === "failed" && line.reason && !signal.aborted) run.errors.push(`Chunk ${line.chunk}: ${line.reason}`);
  };
  for (let seq: number | null = 0; seq !== null && index < run.to && !signal.aborted; ) {
    const page = await deps.chats.readMessages(branchId, { fromSeq: seq, limit: PAGE });
    seq = page.nextSeq;
    for (const m of page.messages) {
      if (m.cut) continue;
      if (index >= run.to || signal.aborted) break;
      if (index >= run.from) {
        const full = chunker.push(`[${m.role}]: ${textOf(m)}`);
        if (full !== null) { await file(full, chunkFrom, index); chunkFrom = index; }
      }
      index += 1;
      run.at = index;
      if (signal.aborted) break;
    }
  }
  const last = signal.aborted ? null : chunker.flush();
  if (last !== null) await file(last, chunkFrom, Math.min(index, run.to));
  run.status = signal.aborted ? "cancelled" : "done";
}

const textOf = (m: Message): string => m.swipes[m.current]?.content ?? "";

async function ingestChunk(deps: CompendiumDeps, run: IngestRun, branchId: string, chunk: string, from: number, to: number, n: number, activity: string[], signal: AbortSignal): Promise<IngestLine> {
  const base = { chunk: n, from, to, created: 0, updated: 0 };
  const scene = await sceneBooks(deps, run.chatId);
  const book = scene?.books.find((b) => b.id === run.bookId);
  const receipt = (await deps.chats.appendReceipt(run.chatId, { branchId, kind: "ingest" }))!;
  const done = async (status: CompendiumReceipt["status"], extra: { reason?: string; writes?: CompendiumReceipt["writes"]; model?: string } = {}): Promise<IngestLine> => {
    const s = await deps.chats.settleReceipt(receipt.id, { status, ...(extra.reason ? { reason: extra.reason.slice(0, 1_500) } : {}), ...(extra.writes ? { writes: extra.writes } : {}), ...(extra.model ? { model: extra.model } : {}) });
    const writes = s?.writes ?? [];
    return { ...base, status, created: writes.filter((w) => w.op === "create").length, updated: writes.filter((w) => w.op === "update").length, receiptId: receipt.id, ...(extra.reason ? { reason: extra.reason } : {}) };
  };
  try {
    if (!scene || !book?.writable) return await done("skipped", { reason: "the book no longer allows writes" });
    const settings = resolveCompendium(scene.chat.compendium);
    const connection = settings.ingest.model === "scene" ? scene.chat.connection : settings.model ?? scene.chat.connection;
    const connected = connection ? await deps.connect(connection) : null;
    if (!connection || !connected) return await done("failed", { reason: "the connection is gone" });
    await deps.chats.settleReceipt(receipt.id, { status: "running", model: connection.model });
    const allow = ingestAllowed(settings.ingest);
    const guide = settings.filing.guide ? (await selectedGuides(deps.state, [settings.filing.guide]))[0]?.content ?? "" : "";
    const first = ingestMessages({
      from, to, chunk, phases: settings.ingest, allow, activity: settings.ingest.continuity ? activity : [], language: settings.language,
      snapshot: settings.ingest.search ? buildSnapshot(scene.books.filter((b) => b.readable && b.writable).map((b) => ({ id: b.id, name: b.name, entries: b.view }))) : "",
      guidance: [guide, settings.filing.guidance].filter(Boolean).join("\n\n"),
    });
    const parsed = await askJson(connected, { model: connection.model, options: { ...MODEL_OPTIONS }, signal }, first, (text) => { const p = parseHistorian(text, allow); return p.ok ? { ok: true, value: p } : p; },
      (m, answer, error) => ({ system: m.system, user: `${m.user}\n\nYour previous answer could not be used (${error}):\n\n${answer.slice(0, 2000)}\n\nAnswer again with only the JSON object.` }));
    if (!parsed.ok) return await done("failed", { reason: parsed.error, model: connection.model });
    const w: Window = { start: from, newStart: from, end: to, turns: 0 };
    // Only the write takes the scene's lane, so a filing, an Undo or a Reconcile waits for one patch and never for a model call.
    const wrote = await enqueue(run.chatId, () => writeRecaps(deps, run.bookId, { items: parsed.value.items, arcs: settings.ingest.narrative ? parsed.value.arcs : [] }, w));
    const notes = [...parsed.value.rejected.map((r) => `item ${r.position}: ${r.reason}`), ...wrote.notes];
    const reason = notes.length > 0 ? notes.join("; ") : undefined;
    if (wrote.status === "conflict" || wrote.status === "missing") return await done("failed", { model: connection.model, reason: `"${book.name}" ${wrote.status === "missing" ? "is gone" : "changed while the ingest worked, so nothing was written to it"}` });
    if (wrote.status === "unchanged") return await done("nothing_to_file", { model: connection.model, ...(reason ? { reason } : {}) });
    for (const item of parsed.value.items) activity.push(activityLine(item.type, item.name));
    return await done("filed", { writes: wrote.writes, model: connection.model, ...(reason ? { reason } : {}) });
  } catch (error) {
    // A stop mid-call is an interruption, not a failure; either way nothing was half written (the book is patched once, after the answer).
    const aborted = signal.aborted;
    return done(aborted ? "interrupted" : "failed", { reason: aborted ? "cancelled" : error instanceof ProviderError ? error.message : toErrorMessage(error, "the model did not answer") });
  }
}

/** Takes back every chunk of a run, newest first; each is its own guarded undo, so an entry edited since is skipped and named. */
export async function undoIngest(deps: CompendiumDeps, chatId: string, runId: string): Promise<{ undone: number; failed: string[] }> {
  const run = runs.get(chatId);
  if (!run || run.id !== runId) throw new StudioNotFoundError("that ingest is no longer in memory; undo its chunks from Activity");
  const receipts = (await Promise.all(run.lines.filter((l) => l.status === "filed").map((l) => deps.chats.receipt(l.receiptId)))).filter((r): r is CompendiumReceipt => r !== null).reverse();
  return enqueue(chatId, () => undoAll(deps, chatId, receipts));
}
