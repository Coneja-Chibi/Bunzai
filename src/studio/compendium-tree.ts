/**
 * Building the Compendium's tree with a model, and the hand edits to it (04b Track D3; RoleCall `lib/lorebook/tv-tree-llm.ts`).
 * A build reads one book, asks the Compendium's model to sort its entries into categories (one call when the entries fit, else a
 * first pass over names and then placement in chunks against the fixed category list), holds the answer to the person's Lock,
 * Forbid and Reorganize, and stores the result as the book's newest layout with the scene (ChatStore rule 40). It writes the book
 * only when "Refine entries during build" is on, for a book the scene may write to (`compendium-refine.ts`: classic entries split
 * and merged through receipts that Activity's Undo takes back); otherwise a build that fails changes nothing. The layout can be
 * taken back with Undo last build, which shows the layout before it or the derived tree; and every call is one JSON answer with at
 * most one repair (F13). Callers run it inside the scene's lane.
 */
import { canWrite, isActive, resolveCompendium, readBook, categorizable, assembleLayout, categorizeMessages, assignMessages, categoryPaths, constraintBlock, DETAIL_TOKENS, entryLine, moveInLayout, parseAssignments, parseCategories, reassign, repairTree, resolvePreset, TOKEN_BUDGET, type RawCategory } from "../core/compendium";
import { entityRevision } from "../kit/changes/revision";
import type { StoredLayout, StoredTree } from "../stage/contracts/chat-store";
import { StudioConflictError } from "./atomic-file";
import { askJson, type Ask, type Parsed } from "./compendium-ask";
import { sceneBooks, type CompendiumDeps } from "./compendium-deps";
import { refineBuilt } from "./compendium-refine";
import { runOf } from "./compendium-standardize";
import { StudioNotFoundError } from "./errors";
import type { Connected } from "./scene-turn";

export interface BuildOptions {
  signal?: AbortSignal;
  /** The most estimated tokens one call may carry; tests lower it to reach the chunked path. */
  budget?: number;
  /** Entries per placement call in the chunked path; tests lower it. */
  chunk?: number;
}

const PARALLEL = 3;
const AUTO_SEQUENTIAL_LIMIT = 200;
const TEMPERATURE = 0.2;

const failed = (error: string): never => { throw new StudioConflictError(error); };
const value = <T>(p: Parsed<T>): T => (p.ok ? p.value : failed(p.error));

/** Runs `tasks` with at most `width` in flight, keeping each result at its own position. */
async function inPool<T>(tasks: readonly (() => Promise<T>)[], width: number): Promise<T[]> {
  const out: T[] = new Array<T>(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, tasks.length) }, async () => {
    while (next < tasks.length) { const at = next++; out[at] = await tasks[at]!(); }
  }));
  return out;
}

export async function buildCompendiumTree(deps: CompendiumDeps, chatId: string, bookId: string, opts: BuildOptions = {}): Promise<{ tree: StoredTree; notes: string[] }> {
  const scene = await sceneBooks(deps, chatId);
  if (!scene) throw new StudioNotFoundError("that scene is gone");
  const book = scene.books.find((b) => b.id === bookId);
  if (!book) throw new StudioNotFoundError("that book is not one this scene reads");
  if (book.access === "off") throw new StudioConflictError("this book is switched off for the Compendium");
  const settings = resolveCompendium(scene.chat.compendium);
  const connection = settings.model ?? scene.chat.connection;
  if (!connection) throw new StudioConflictError("this scene has no connection to build the tree with");
  const connected: Connected | null = await deps.connect(connection);
  if (!connected) throw new StudioConflictError("the connection is gone from Kit");

  const entity = await deps.store.read("lorebook", bookId);
  if (entity?.kind !== "lorebook") throw new StudioNotFoundError("that book is not in your library");
  const rev = entityRevision(entity);
  const raw = entity.body.entries;
  const entries = readBook(raw).filter(categorizable);
  if (entries.length === 0) failed("there are no entries to build a tree from");

  const constraints = scene.chat.compendium?.books?.[bookId]?.tree ?? {};
  const previous = (await deps.chats.currentTree(chatId, bookId))?.layout ?? null;
  const names = new Map<string, string>(entries.map((e) => [e.id, e.name]));
  const addNames = (n: StoredLayout["root"]): void => { if (n.id !== "root") names.set(n.id, n.label); n.children.forEach(addNames); };
  if (previous) addNames(previous.root);

  const { granularity, detail, placement } = settings.treeBuild;
  const preset = resolvePreset(granularity, entries.length);
  const budget = opts.budget ?? TOKEN_BUDGET;
  const barred = new Set(constraints.forbidden ?? []);
  const lineAt = (i: number, d: typeof detail): string | null => (barred.has(entries[i]!.id) ? null : entryLine(entries[i]!, raw.find((r) => r.id === entries[i]!.id)!, i, d));
  const linesAt = (d: typeof detail): string[] => entries.flatMap((_, i) => lineAt(i, d) ?? []);
  const ask: Ask = { model: connection.model, options: { temperature: TEMPERATURE, max_tokens: Math.min(16_000, 4_000 + entries.length * 12) }, ...(opts.signal ? { signal: opts.signal } : {}) };
  const block = constraintBlock(constraints, names);
  const notes: string[] = [];

  const cost = (d: keyof typeof DETAIL_TOKENS) => entries.length * DETAIL_TOKENS[d];
  const single = cost(detail) <= budget;
  // The first pass shows every entry at the richest detail that fits one call; a book too big even for names cannot be sorted in one pass.
  const firstDetail = single ? detail : cost("names") <= budget ? "names" : failed("this book is too large to build a tree in one pass; split it into smaller books");
  const first = value(await askJson(connected, ask, categorizeMessages({ preset, lines: linesAt(firstDetail), block, language: settings.language }),
    (text) => { const p = parseCategories(text, entries.length); return p.ok ? { ok: true, value: p } : p; }, repairTree));
  let categories: RawCategory[] = first.categories;

  if (!single && detail !== "names") {
    const paths = categoryPaths(categories);
    const size = opts.chunk ?? Math.min(400, Math.max(20, Math.floor(60_000 / DETAIL_TOKENS[detail])));
    const idx = entries.flatMap((_, i) => (barred.has(entries[i]!.id) ? [] : [i]));
    const chunks = Array.from({ length: Math.ceil(idx.length / size) }, (_, c) => idx.slice(c * size, (c + 1) * size));
    const width = placement === "parallel" || (placement === "auto" && entries.length > AUTO_SEQUENTIAL_LIMIT) ? PARALLEL : 1;
    const results = await inPool(chunks.map((chunk, c) => async () => {
      const lines = chunk.map((i) => lineAt(i, detail)!);
      const p = await askJson(connected, ask, assignMessages({ paths, lines, language: settings.language }),
        (text) => { const a = parseAssignments(text, entries.length, paths); return a.ok ? { ok: true, value: a.assigned } : a; }, repairTree);
      if (!p.ok) notes.push(`placement ${c + 1} of ${chunks.length} could not be read, so those entries keep their first-pass branch`);
      return p.ok ? p.value : new Map<number, string>();
    }), width);
    categories = reassign(categories, new Map(results.flatMap((m) => [...m])));
  }

  const built = assembleLayout({ answer: { summary: first.summary, categories }, entries, previous, constraints, meta: { rev, model: connection.model, granularity, detail } });
  let layout = built.layout;
  if (settings.treeBuild.refine) {
    const why = !canWrite(book.access) ? "this book does not allow writing, so Compendium cannot change its entries; allow writing from the access chip first"
      : !settings.on ? "the Compendium is off for this scene"
      : isActive(runOf(chatId, bookId) ?? { status: "complete" }) ? "Standardization is running on this book"
      : null;
    if (why) notes.push(`Refine entries was skipped: ${why}`);
    else {
      const refined = await refineBuilt({ deps, chatId, branchId: scene.chat.activeBranchId, bookId, connected, model: connection.model, language: settings.language, ...(opts.signal ? { signal: opts.signal } : {}), layout, entries: raw, constraints });
      layout = refined.layout;
      notes.push(...refined.notes);
    }
  }
  const tree = await deps.chats.appendTree(chatId, bookId, layout);
  if (!tree) throw new StudioNotFoundError("that scene is gone");
  // Reorganize is one build only: it clears once its layout is stored, and stays if the build failed.
  if ((constraints.reorganize ?? []).length > 0) {
    const { reorganize: _, ...rest } = constraints;
    await deps.chats.setCompendium(chatId, { books: { [bookId]: { tree: Object.keys(rest).length > 0 ? rest : null } } });
  }
  return { tree, notes: [...notes, ...built.notes] };
}

/** Files one entry under a branch of the built tree, as a new layout that Undo can take back. There is nothing to move in until a tree has been built. */
export async function moveEntryInTree(deps: CompendiumDeps, chatId: string, bookId: string, entryId: string, nodeId: string): Promise<StoredTree> {
  const current = await deps.chats.currentTree(chatId, bookId);
  if (!current) throw new StudioConflictError("Tree not built yet - build one first");
  const layout = moveInLayout(current.layout, entryId, nodeId);
  if (!layout) throw new StudioConflictError("that branch is not part of the built tree");
  const tree = await deps.chats.appendTree(chatId, bookId, layout);
  if (!tree) throw new StudioNotFoundError("that scene is gone");
  return tree;
}

/** Takes back the newest layout; the one before it shows, or the derived tree when none is left. */
export async function undoCompendiumTree(deps: CompendiumDeps, chatId: string, bookId: string): Promise<{ undone: boolean; current: StoredTree | null }> {
  const done = await deps.chats.undoTree(chatId, bookId);
  if (!done) throw new StudioNotFoundError("that scene is gone");
  return done;
}
