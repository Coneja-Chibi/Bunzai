/**
 * What the Activity tab and the Dashboard's Recent Writes make of the scene's receipts (RoleCall `LorebookActivityFeed.tsx`,
 * `lib/compendium/activity.ts:46-126`; 04b F15, F25). One POST card per receipt, read from the receipt alone: the verb, the model,
 * the entries it touched with what happened to each, why it was skipped or failed, and whether it can be undone or filed again; one
 * PRE card per entry the recall pass retrieved, read from the reply's trace (RoleCall's pre-gen `search_lorebook` rows,
 * `pregen-retrieval.ts:669-693`); one LIVE card per tool call the narrator made while it wrote the reply (turn-loop rule 18), read from the same trace,
 * RoleCall's during-gen `search_lorebook` row (`TVStreamService.ts:575-590`). A Historian receipt (kind `historian`) is a HIST card, RoleCall's "Summarized"; an ingest chunk (kind `ingest`) is an "Ingested" POST card. Clear feed is a
 * watermark: a card older than it is hidden here and never deleted. Pure.
 */
import type { CompendiumReceipt, ReceiptKind, ReceiptOp } from "../../../../stage/contracts/chat-store";
import type { SceneTrace } from "../../../app-contract-scenes";
import type { EntryType } from "../../../../core/compendium";
import type { RecentWrite } from "./cells/cells-lists";

export type FeedTab = "all" | "entries" | "tools";

export interface WriteLine { entryId: string; bookId: string; name: string; type: EntryType | null; verb: string; fields: string[] }

export interface ActivityRow {
  id: string;
  /** RoleCall's card labels: Remembered, Updated, Post-Gen; and the Bunraku ones: Reconciled, Undone. */
  label: string;
  phase: "PRE" | "LIVE" | "POST" | "HIST";
  model?: string;
  at: number;
  /** The one line under the label. */
  text: string;
  /** Whether it is an error: failed, interrupted or damaged. */
  error: boolean;
  /** `Error` chip text when `error`. */
  status: string;
  lines: WriteLine[];
  reason?: string;
  damaged: boolean;
  canUndo: boolean;
  canFileAgain: boolean;
  /** ENTRIES when it wrote or restored an entry, TOOLS for a search, and null for a status row (skipped, failed, nothing to file): RoleCall lists those under ALL only. */
  tab: Exclude<FeedTab, "all"> | null;
  /** Which kind of card: a filing (the default look), a Standardize run's receipt, or the Revert of one. */
  card?: "standardize" | "revert";
  /** A PRE card's entry, as the chips RoleCall draws: its title, the book, how it was picked and what it cost. */
  recalled?: { title: string; book: string; trigger: string; tokens: number };
  /** "Why this entry": the recall selector's reason, shown to the person only. */
  why?: string;
  /** A LIVE card's entries, as chips: the narrator's lookup returned them. */
  retrieved?: { title: string; book: string; tokens: number }[];
}

export interface EntryFacts { name: string; type: EntryType | null }

const VERB: Record<ReceiptOp, string> = { create: "created", update: "updated", retire: "retired", mirror: "mirrored" };
const PAST: Record<ReceiptOp, string> = { create: "Remembered", update: "Updated", retire: "Retired", mirror: "Reconciled" };

const fieldsOf = (w: CompendiumReceipt["writes"][number]): string[] => [...new Set([...Object.keys(w.fields.before), ...Object.keys(w.fields.after)])].map((k) => k.replace(/^data\./, "")).filter((k) => k !== "content");

/** Names the entry of a write: the book's own title when it is known, else what the pass wrote, else a short id. */
function nameOf(w: CompendiumReceipt["writes"][number], facts: ReadonlyMap<string, EntryFacts>): EntryFacts {
  const known = facts.get(w.entryId);
  if (known) return known;
  const wrote = ["data.name", "data.title", "data.topic"].map((k) => w.fields.after[k]).find((v) => typeof v === "string");
  return { name: typeof wrote === "string" ? wrote : w.entryId.slice(0, 8), type: null };
}

type Kinds = ReadonlyMap<string, ReceiptKind>;
type Write = CompendiumReceipt["writes"][number];

/** A Standardize write's verb: a source typed in place, a merge into a typed entry, a new entry, a consumed source. */
const stdVerb = (w: Write): string => (w.op === "create" ? "created" : w.op === "retire" ? "retired" : "type" in w.fields.after ? "typed" : "merged");

/** The card a receipt is: the undo of a Standardize receipt is a Revert, found through the receipt it names. */
const cardOf = (r: CompendiumReceipt, kinds: Kinds): ActivityRow["card"] =>
  r.kind === "standardize" ? "standardize" : r.kind === "undo" && r.undoes !== undefined && kinds.get(r.undoes) === "standardize" ? "revert" : undefined;

/** "Standardized 2 entries (1 merged, 1 new, 1 consumed)": the entries typed in place, then what else the run did (RoleCall's Complete line, `BentoDashboard.tsx:1236-1251`). */
function standardized(r: CompendiumReceipt): string {
  const count = (verb: string) => r.writes.filter((w) => stdVerb(w) === verb).length;
  const typed = count("typed");
  const more = ([["merged", "merged"], ["created", "new"], ["retired", "consumed"]] as const).flatMap(([verb, word]) => (count(verb) > 0 ? [`${count(verb)} ${word}`] : []));
  return `Standardized ${typed} ${typed === 1 ? "entry" : "entries"}${more.length > 0 ? ` (${more.join(", ")})` : ""}`;
}

function labelOf(r: CompendiumReceipt, card: ActivityRow["card"]): string {
  if (card === "standardize") return "Standardized";
  if (card === "revert") return "Reverted";
  if (r.kind === "undo") return "Undone";
  if (r.kind === "mirror") return "Reconciled";
  if (r.kind === "historian") return r.status === "skipped" ? "Skipped" : r.writes.length > 0 ? "Summarized" : "Historian";
  if (r.kind === "ingest") return "Ingested";
  if (r.kind === "refine") return r.status === "skipped" ? "Skipped" : "Merged/Split";
  if (r.status === "skipped") return "Skipped";
  if (r.writes.length === 0) return "Post-Gen";
  const ops = new Set(r.writes.map((w) => w.op));
  return ops.size === 1 ? PAST[[...ops][0]!] : "Post-Gen";
}

function textOf(r: CompendiumReceipt, card: ActivityRow["card"]): string {
  const n = r.writes.length;
  if (card === "standardize") {
    switch (r.status) {
      case "queued": case "running": return "Standardizing";
      case "filed": return standardized(r);
      case "partly_filed": return `${standardized(r)}, some entries were not written`;
      case "nothing_to_file": return "Nothing converted";
      case "undone": return `${standardized(r)}, then reverted`;
      case "skipped": return `Skipped: ${r.reason ?? "no reason given"}`;
      case "failed": return `Failed: ${r.reason ?? "no reason given"}`;
      case "interrupted": return "Stopped before it finished";
    }
  }
  if (card === "revert") {
    if (r.status === "filed") return `Reverted ${n} ${n === 1 ? "entry" : "entries"}`;
    if (r.status === "partly_filed") return `Reverted ${n}, some left as they are`;
  }
  switch (r.status) {
    case "queued": return r.kind === "historian" ? "Waiting to summarize" : "Waiting to file";
    case "running": return r.kind === "historian" ? "Summarizing" : r.kind === "ingest" ? "Ingesting" : r.kind === "refine" ? "Refining" : "Filing";
    case "filed": return r.kind === "refine" ? `Refined ${n} ${n === 1 ? "entry" : "entries"}` : r.kind === "undo" ? `Restored ${n} ${n === 1 ? "entry" : "entries"}` : `Filed ${n} ${n === 1 ? "entry" : "entries"}`;
    case "partly_filed": return r.kind === "undo" ? `Restored ${n}, some skipped` : `Filed ${n}, some books were not written`;
    case "nothing_to_file": return "Nothing to file";
    case "skipped": return `Skipped: ${r.reason ?? "no reason given"}`;
    case "failed": return `Failed: ${r.reason ?? "no reason given"}`;
    case "interrupted": return "Stopped before it finished";
    case "undone": return `Filed ${n} ${n === 1 ? "entry" : "entries"}, then undone`;
  }
}

export function toRow(r: CompendiumReceipt, facts: ReadonlyMap<string, EntryFacts>, kinds: Kinds = new Map()): ActivityRow {
  const card = cardOf(r, kinds);
  const lines = r.writes.map((w): WriteLine => ({ entryId: w.entryId, bookId: w.bookId, ...nameOf(w, facts), verb: card === "standardize" ? stdVerb(w) : VERB[w.op], fields: fieldsOf(w) }));
  const bad = r.damaged === true || r.status === "failed" || r.status === "interrupted";
  return {
    id: r.id, ...(card ? { card } : {}), label: r.damaged ? "Damaged" : labelOf(r, card), phase: r.kind === "historian" ? "HIST" : "POST", ...(r.model ? { model: r.model } : {}), at: r.at,
    text: r.damaged ? "This receipt could not be read, so what it filed cannot be shown or undone." : textOf(r, card),
    error: bad, status: r.damaged ? "Damaged" : r.status === "interrupted" ? "Interrupted" : "Error",
    lines, ...(r.reason ? { reason: r.reason } : {}), damaged: r.damaged === true,
    canUndo: !r.damaged && (r.kind === "filing" || r.kind === "mirror" || r.kind === "historian" || r.kind === "ingest" || r.kind === "refine") && (r.status === "filed" || r.status === "partly_filed") && r.writes.length > 0,
    canFileAgain: !r.damaged && r.kind === "filing" && r.swipeId !== undefined && (r.status === "undone" || r.status === "failed" || r.status === "interrupted" || r.status === "skipped" || r.status === "nothing_to_file"),
    tab: r.writes.length > 0 ? "entries" : null,
  };
}

const PRE_NONE = "Pre-gen retrieval found no relevant entries for this scene";

/** The PRE cards of one reply's recall pass: a Searched card per retrieved entry, one line when it found none, an Error card when it failed, nothing when it was skipped or never ran (RoleCall emits nothing when recall is off). */
export function recallRows(trace: SceneTrace | null): ActivityRow[] {
  const recall = trace?.recall;
  if (!trace || !recall || recall.status === "skipped") return [];
  const card = { label: "Searched", phase: "PRE" as const, ...(recall.model ? { model: recall.model } : {}), at: recall.at ?? 0, lines: [], damaged: false, canUndo: false, canFileAgain: false, tab: "tools" as const };
  const id = `pre:${trace.reply.swipeId}`;
  if (recall.status === "failed") return [{ ...card, id, text: `Recall failed: ${recall.reason ?? "no reason given"}`, error: true, status: "Error" }];
  if (recall.injected.length === 0) return [{ ...card, id, text: PRE_NONE, error: false, status: "" }];
  return recall.injected.map((h) => ({
    ...card, id: `${id}:${h.bookId}:${h.entryId}`, text: `Retrieved: ${h.title}`, error: false, status: "",
    recalled: { title: h.title, book: h.bookName, trigger: "Retrieved", tokens: h.tokens }, ...(h.reason ? { why: h.reason } : {}),
  }));
}

const count = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;

/** The LIVE cards of one reply: a Searched card per tool call (RoleCall's "Retrieved N entries during generation"), an Error card for a call that failed; the model chip is the narrator's, which made the call. */
export function liveRows(trace: SceneTrace | null): ActivityRow[] {
  const tools = trace?.tools;
  if (!trace || !tools) return [];
  return tools.calls.map((c, i): ActivityRow => ({
    id: `live:${trace.reply.swipeId}:${i}`, label: "Searched", phase: "LIVE", model: tools.model, at: tools.at, lines: [], damaged: false, canUndo: false, canFileAgain: false, tab: "tools", reason: c.args,
    ...(c.ok
      ? { text: `Retrieved ${count(c.entries.length)} during generation`, error: false, status: "", retrieved: c.entries.map((e) => ({ title: e.title, book: e.bookName, tokens: e.tokens })) }
      : { text: `Lookup failed: ${c.error ?? "no reason given"}`, error: true, status: "Error" }),
  }));
}

/** The feed: receipts newer than the watermark, filtered by tab, newest first (the list arrives in that order). */
export function feedRows(receipts: readonly CompendiumReceipt[], clearedAt: number, tab: FeedTab, facts: ReadonlyMap<string, EntryFacts>): ActivityRow[] {
  const kinds: Kinds = new Map(receipts.map((r) => [r.id, r.kind]));
  return receipts.filter((r) => r.at > clearedAt).map((r) => toRow(r, facts, kinds)).filter((row) => tab === "all" || row.tab === tab);
}

/** "3m ago" style time, RoleCall's relative stamp. */
export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

/** The Dashboard's Recent Writes (F15): the entries the receipts filed or restored, newest first, each with its verb; an undone filing's entries are not listed as written. */
export function recentWritesOf(receipts: readonly CompendiumReceipt[], facts: ReadonlyMap<string, EntryFacts>, now: number): RecentWrite[] {
  const out: RecentWrite[] = [];
  for (const r of receipts) {
    if (r.damaged || r.status === "undone" || (r.status !== "filed" && r.status !== "partly_filed")) continue;
    for (const w of r.writes) {
      const f = nameOf(w, facts);
      out.push({ entryId: w.entryId, name: f.name, type: f.type, detail: r.kind === "undo" ? "restored" : VERB[w.op], at: ago(r.at, now) });
    }
  }
  return out;
}
