/**
 * How a receipt names the parts of an entry it changed, written once so filing, Undo and
 * Reconcile cannot disagree. A key is `data.<field>` for a field of `metadata.structured_data`, `type` for `metadata.entry_type` (set when Standardize types a classic entry; removing it gives back the classic entry), `content` for the derived text
 * (kept only when it was not the render of the data, so Undo gives back hand-written text exactly), `title` (Refine renames the entry it splits), `triggers` and `secondaryTriggers` (a Refine merge carries keywords over), `enabled`, `retired` for
 * `metadata.retired`, or `kept` for `metadata.reconcile.kept`. In a write's `after`, a key missing from `before` means the field was
 * absent, and Undo deletes it. Pure: nothing here reads a store.
 */
import { deepEq, isRecord, type Rec } from "../guards";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import type { JsonObject } from "../../stage/contracts/chat-store";
import { readEntry } from "./read";
import { renderContent } from "./render";

const DATA = "data.";

const meta = (entry: LorebookEntry): Rec => (isRecord(entry.metadata) ? entry.metadata : {});
const structured = (entry: LorebookEntry): Rec => (isRecord(meta(entry)["structured_data"]) ? (meta(entry)["structured_data"] as Rec) : {});
const reconcile = (entry: LorebookEntry): Rec => (isRecord(meta(entry)["reconcile"]) ? (meta(entry)["reconcile"] as Rec) : {});

function held(entry: LorebookEntry, key: string): unknown {
  if (key.startsWith(DATA)) return structured(entry)[key.slice(DATA.length)];
  switch (key) {
    case "type": return meta(entry)["entry_type"];
    case "content": return entry.content;
    case "title": return entry.title;
    case "triggers": return entry.triggers;
    case "secondaryTriggers": return entry.secondaryTriggers;
    case "enabled": return entry.enabled;
    case "retired": return meta(entry)["retired"];
    case "kept": return reconcile(entry)["kept"];
    default: return undefined;
  }
}

/** The values the entry holds now for these keys; a key the entry lacks is left out. */
export function heldFields(entry: LorebookEntry, keys: Iterable<string>): Rec {
  const out: Rec = {};
  for (const key of keys) {
    const value = held(entry, key);
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

const without = (rec: Rec, key: string): Rec => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));

/** The entry with these keys set and these removed; its `content` is re-rendered from the data unless the change names it. */
export function setFields(entry: LorebookEntry, set: Rec, remove: readonly string[] = []): LorebookEntry {
  let next: LorebookEntry = { ...entry };
  let data = structured(entry);
  let metadata: Rec = { ...meta(entry) };
  let dataChanged = false;
  for (const key of [...Object.keys(set), ...remove]) {
    const value = key in set ? set[key] : undefined;
    if (key.startsWith(DATA)) {
      const field = key.slice(DATA.length);
      data = value === undefined ? without(data, field) : { ...data, [field]: value };
      dataChanged = true;
    } else if (key === "type") metadata = value === undefined ? without(metadata, "entry_type") : { ...metadata, entry_type: value };
    else if (key === "content") next = { ...next, content: typeof value === "string" ? value : next.content };
    else if (key === "triggers" || key === "secondaryTriggers") next = { ...next, [key]: Array.isArray(value) ? value : next[key] } as LorebookEntry;
    else if (key === "title") next = { ...next, title: typeof value === "string" ? value : next.title };
    else if (key === "enabled") next = { ...next, enabled: value === true };
    else if (key === "retired") metadata = value === undefined ? without(metadata, "retired") : { ...metadata, retired: value };
    else if (key === "kept") {
      const rest = without(isRecord(metadata["reconcile"]) ? (metadata["reconcile"] as Rec) : {}, "kept");
      metadata = { ...metadata, reconcile: value === undefined ? rest : { ...rest, kept: value } };
    }
  }
  if (dataChanged) metadata = Object.keys(data).length === 0 && metadata["entry_type"] === undefined ? without(metadata, "structured_data") : { ...metadata, structured_data: data };
  const { metadata: _old, ...bare } = next;
  next = Object.keys(metadata).length === 0 ? bare : { ...bare, metadata };
  const type = readEntry(next, 0).type;
  if (dataChanged && type && !("content" in set)) next = { ...next, content: renderContent(type, data) };
  return next;
}

/** What filing records for a change to an entry's data: the changed fields before and after, plus the old text when it was not the render of the old data. */
export function dataDiff(entry: LorebookEntry, before: Rec, after: Rec): { before: JsonObject; after: JsonObject } {
  const type = readEntry(entry, 0).type;
  const out = { before: {} as JsonObject, after: {} as JsonObject };
  // The filing schema accepted only plain JSON data, so these values are JSON.
  for (const [k, v] of Object.entries(before)) out.before[DATA + k] = v as JsonObject[string];
  for (const [k, v] of Object.entries(after)) out.after[DATA + k] = v as JsonObject[string];
  if (type && entry.content !== renderContent(type, structured(entry))) out.before["content"] = entry.content;
  return out;
}

export type UndoVerdict =
  | { kind: "restore"; set: Rec; remove: string[] }
  /** Already as it was, or the entry is gone: nothing to do (F4). */
  | { kind: "nothing" }
  /** The entry is not as the pass left it: skipped and reported. */
  | { kind: "changed" };

/** Whether and how one receipt write is reversed against the entry as it stands, guarded by the values the pass wrote (RoleCall's conflict rule, `world-write/rollback.ts`). */
export function planUndo(write: ReceiptWrite, current: LorebookEntry | undefined, receiptId: string, now: number): UndoVerdict {
  if (!current) return { kind: "nothing" };
  const { before, after } = write.fields;
  const holdsAfter = Object.entries(after).every(([k, v]) => deepEq(held(current, k), v));
  if (write.op === "create") {
    if (held(current, "retired") !== undefined) return { kind: "nothing" };
    // A created entry is the pass's whole: any edit by the person since, even to a field the pass did not write, keeps it visible.
    const created = Object.fromEntries(Object.entries(after).filter(([k]) => k.startsWith(DATA)).map(([k, v]) => [k.slice(DATA.length), v]));
    return holdsAfter && deepEq(structured(current), created) ? { kind: "restore", set: { enabled: false, retired: { at: now, receipt: receiptId } }, remove: [] } : { kind: "changed" };
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const restored = keys.every((k) => (k in before ? deepEq(held(current, k), before[k]) : held(current, k) == null));
  if (restored) return { kind: "nothing" };
  if (!holdsAfter) return { kind: "changed" };
  if ("type" in after && !("type" in before)) {
    // Giving back an untyped entry drops its typed fields, so a field the pass did not write (filed in since) keeps it as it is.
    const mine = new Set([...Object.keys(after), ...Object.keys(before)].filter((k) => k.startsWith(DATA)).map((k) => k.slice(DATA.length)));
    if (Object.keys(structured(current)).some((f) => !mine.has(f))) return { kind: "changed" };
  }
  return { kind: "restore", set: before, remove: Object.keys(after).filter((k) => !(k in before)) };
}
