/**
 * RoleCall compendium export codec (`compendium-v1.0.0`, `format: "rolecall-compendium"`, the file RoleCall's Dashboard EXPORT
 * downloads as `<name>__<timestamp>.compendium.json`). Unlike the v1 lorebook export it is flat: `entries` sit at the top level as
 * raw `lorebook_entries` rows (snake_case columns, the whole `metadata` blob), beside `categories`, `tree` and `nodeConstraints`
 * (`compendium/export/route.ts:145-202`, importer `compendium/import/route.ts:66-116`). Column names are the importer's
 * allow-list; their values are read as the canonical values (position, role and the rest), each checked by kind so a bad cell falls
 * back to the default instead of reaching the engine.
 *
 * Reading keeps the parsed file in `original`; writing an entity that has one overwrites only the columns the person changed, so
 * RoleCall-only columns, the tree and the node constraints survive. Writing from nothing (Bunraku's own export) emits `tree: null`
 * and no constraints, because Bunraku derives the tree and stores none. Fields RoleCall has no column for ride in an
 * `unsupported_fields` bag RoleCall's importer ignores. "Featured" is the `is_featured` column, not part of the exported metadata.
 * `compendiumChunks` is the streaming writer: a header, one chunk per entry, a footer.
 */
import type { AdapterInput, AdapterOutput, LorebookAdapter } from "../../core/adapter";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { deepEq, isRecord, numOr, optStr, strArray, strOr, type Rec } from "../../core/guards";
import { emptyLoreEntry } from "../../core/lore";
import type { CanonicalLorebook, LorebookBody, LorebookCategory, LorebookEntry } from "../../entities/lorebook/schema";
import { readJsonObject } from "../_shared/card-io";
import { ensureUniqueEntryIds } from "../_shared/lore-enums";
import { triggerToWire, triggersToCanonical } from "./lorebook";

export const COMPENDIUM_SCHEMA = "compendium-v1.0.0";
const FORMAT = "rolecall-compendium";
const ESCROW = "rolecall-compendium";

type Kind = "b" | "n" | "s" | "a" | "o" | `${"b" | "n" | "s" | "a" | "o"}?`;
/** Column, entry field and the kind of value it holds; a trailing `?` allows null. */
const COLUMNS: readonly (readonly [string, keyof LorebookEntry, Kind])[] = [
  ["comment", "comment", "s?"], ["enabled", "enabled", "b"], ["constant", "constant", "b"], ["trigger_mode", "triggerMode", "s"],
  ["selective_logic", "selectiveLogic", "s"], ["case_sensitive", "caseSensitive", "b?"], ["match_whole_words", "matchWholeWords", "b?"], ["scan_depth", "scanDepth", "n?"],
  ["position", "position", "s"], ["depth", "depth", "n"], ["role", "role", "s"], ["sort_order", "sortOrder", "n"], ["priority", "priority", "n"],
  ["sticky", "sticky", "n"], ["cooldown", "cooldown", "n"], ["delay", "delay", "n"], ["group_name", "groupName", "s?"], ["group_weight", "groupWeight", "n"],
  ["category_id", "categoryId", "s?"], ["probability", "probability", "n"], ["use_memo", "useMemo", "b"], ["exclude_recursion", "excludeRecursion", "b"],
  ["prevent_recursion", "preventRecursion", "b"], ["delay_until_recursion", "delayUntilRecursion", "n"], ["character_filter", "characterFilter", "o?"],
  ["scan_character_description", "scanCharacterDescription", "b"], ["scan_character_personality", "scanCharacterPersonality", "b"], ["scan_user_persona", "scanUserPersona", "b"],
  ["scan_scenario", "scanScenario", "b"], ["ignore_budget", "ignoreBudget", "b"], ["side_effects", "sideEffects", "o?"], ["boost_ids", "boostIds", "a"], ["boost_amount", "boostAmount", "n"],
];
/** Entry fields RoleCall has no column for; they ride in the row's `unsupported_fields`. */
const EXTRAS: readonly (readonly [string, Kind])[] = [
  ["vectorized", "b"], ["groupOverride", "b"], ["useGroupScoring", "b"], ["automationId", "s?"], ["keyRelative", "b"], ["nonStoryActivatable", "b"], ["contextConfig", "o"],
  ["loreBiasGroups", "a"], ["displayIndex", "n?"], ["scanCharacterDepthPrompt", "b"], ["scanCreatorNotes", "b"],
];
const BOOK_EXTRAS: readonly (readonly [string, Kind])[] = [["budgetMode", "s"], ["entryBudget", "n"], ["vectorizedRecursion", "b"], ["enabled", "b"]];
const ENUMS: Record<string, readonly string[]> = {
  triggerMode: ["simple", "advanced"], selectiveLogic: ["and_any", "and_all", "not_any", "not_all"], role: ["system", "user", "assistant"],
  position: ["world", "character", "before_example", "after_example", "depth", "append", "append_bottom", "prepend_top", "scene"],
};

const ok = (kind: Kind, v: unknown): boolean => {
  if (kind.endsWith("?") && v === null) return true;
  switch (kind[0]) {
    case "b": return typeof v === "boolean";
    case "n": return typeof v === "number" && Number.isFinite(v);
    case "s": return typeof v === "string";
    case "a": return Array.isArray(v);
    default: return isRecord(v);
  }
};
/** The value when it has the kind (and is a known word where the field is an enum), else undefined. */
const take = (v: unknown, kind: Kind, field: string): unknown => (ok(kind, v) && (!ENUMS[field] || ENUMS[field]!.includes(v as string)) ? v : undefined);

/** A raw row as a canonical entry. */
function entryOf(row: Rec): LorebookEntry {
  const entry: Rec = { ...emptyLoreEntry(strOr(row["id"], "")), title: strOr(row["title"], ""), content: strOr(row["content"], "") };
  for (const [column, field, kind] of COLUMNS) {
    const v = take(row[column], kind, field);
    if (v !== undefined) entry[field] = v;
  }
  if (Array.isArray(row["triggers"])) entry["triggers"] = triggersToCanonical(row["triggers"].filter((t) => isRecord(t) && typeof t["keyword"] === "string"));
  if (Array.isArray(row["secondary_triggers"])) entry["secondaryTriggers"] = triggersToCanonical(row["secondary_triggers"].filter((t) => isRecord(t) && typeof t["keyword"] === "string"));
  const bag = isRecord(row["unsupported_fields"]) ? row["unsupported_fields"] : {};
  for (const [field, kind] of EXTRAS) {
    const v = take(bag[field], kind, field);
    if (v !== undefined) entry[field] = v;
  }
  if (isRecord(row["metadata"])) entry["metadata"] = { ...row["metadata"] };
  if (row["is_featured"] === true) entry["metadata"] = { ...(entry["metadata"] as Rec | undefined), featured: true };
  return entry as unknown as LorebookEntry;
}

const metaWithoutFeatured = (e: LorebookEntry): Rec | undefined => {
  if (!e.metadata) return undefined;
  const { featured: _featured, ...rest } = e.metadata;
  return rest;
};

/** The columns of an entry, all of them. */
function fullRow(e: LorebookEntry): Rec {
  const row: Rec = { id: e.id, title: e.title, content: e.content };
  for (const [column, field] of COLUMNS) if ((e as unknown as Rec)[field] !== undefined) row[column] = (e as unknown as Rec)[field];
  row["triggers"] = e.triggers.map(triggerToWire);
  row["secondary_triggers"] = e.secondaryTriggers.map(triggerToWire);
  const bag = Object.fromEntries(EXTRAS.filter(([field]) => (e as unknown as Rec)[field] !== undefined).map(([field]) => [field, (e as unknown as Rec)[field]]));
  if (Object.keys(bag).length > 0) row["unsupported_fields"] = bag;
  row["metadata"] = metaWithoutFeatured(e) ?? null;
  row["is_featured"] = e.metadata?.["featured"] === true;
  return row;
}

/** The raw row with only the columns that differ from what it already says overwritten. */
function mergedRow(e: LorebookEntry, raw: Rec): Rec {
  const was = entryOf(raw) as unknown as Rec;
  const now = e as unknown as Rec;
  const full = fullRow(e);
  const row: Rec = { ...raw, id: e.id };
  const columns: [string, string][] = [["title", "title"], ["content", "content"], ["triggers", "triggers"], ["secondary_triggers", "secondaryTriggers"], ...COLUMNS.map(([c, f]): [string, string] => [c, f])];
  for (const [column, field] of columns) if (!deepEq(now[field], was[field])) row[column] = full[column];
  if (EXTRAS.some(([field]) => !deepEq(now[field], was[field]))) row["unsupported_fields"] = { ...(isRecord(raw["unsupported_fields"]) ? raw["unsupported_fields"] : {}), ...(full["unsupported_fields"] as Rec | undefined) };
  if (!deepEq(e.metadata, was["metadata"])) {
    row["metadata"] = full["metadata"];
    row["is_featured"] = full["is_featured"];
  }
  return row;
}

const categoryOf = (c: unknown): LorebookCategory | null =>
  isRecord(c) && typeof c["id"] === "string" && typeof c["name"] === "string" ? { id: c["id"], name: c["name"], sortOrder: numOr(c["sort_order"], 0), enabled: c["enabled"] !== false } : null;
const categoryRow = (c: LorebookCategory): Rec => ({ id: c.id, name: c.name, sort_order: c.sortOrder, enabled: c.enabled ?? true });

function bodyOf(book: Rec, entries: unknown[], categories: unknown): LorebookBody {
  const bag = isRecord(book["unsupported_fields"]) ? book["unsupported_fields"] : {};
  const extra: Rec = {};
  for (const [field, kind] of BOOK_EXTRAS) {
    const v = take(bag[field], kind, field);
    if (v !== undefined) extra[field] = v;
  }
  const cats = Array.isArray(categories) ? categories.flatMap((c) => categoryOf(c) ?? []) : [];
  return {
    name: strOr(book["name"], ""), tags: strArray(book["tags"]),
    ...Object.fromEntries(([["description", "description"], ["genre", "genre"], ["fandom", "fandom"], ["lorebookType", "lorebook_type"]] as const).filter(([, c]) => book[c] !== undefined).map(([f, c]) => [f, optStr(book[c]) ?? null])),
    globalCaseSensitive: book["global_case_sensitive"] === true, globalMatchWholeWords: book["global_match_whole_words"] === true, globalScanDepth: numOr(book["global_scan_depth"], 0),
    globalRecursion: book["global_recursion"] === true, tokenBudget: numOr(book["token_budget"], 0), budgetMode: "token", entryBudget: 0, ...extra,
    entries: ensureUniqueEntryIds(entries.filter(isRecord).map(entryOf)), ...(cats.length > 0 ? { categories: cats } : {}),
  } as LorebookBody;
}

/** The lorebook object of the file, from a body. */
function bookRow(body: LorebookBody, id: string): Rec {
  const bag = Object.fromEntries(BOOK_EXTRAS.filter(([field]) => (body as unknown as Rec)[field] !== undefined).map(([field]) => [field, (body as unknown as Rec)[field]]));
  return {
    id, name: body.name, global_case_sensitive: body.globalCaseSensitive, global_match_whole_words: body.globalMatchWholeWords,
    global_scan_depth: body.globalScanDepth, global_recursion: body.globalRecursion, token_budget: body.tokenBudget, tags: body.tags, unsupported_fields: bag,
    ...Object.fromEntries(([["description", "description"], ["genre", "genre"], ["fandom", "fandom"], ["lorebookType", "lorebook_type"]] as const).filter(([f]) => body[f] !== undefined).map(([f, c]) => [c, body[f]])),
  };
}

const counts = (entries: readonly LorebookEntry[]): Rec => {
  const typed = entries.filter((e) => typeof e.metadata?.["entry_type"] === "string" && e.metadata["entry_type"].trim() !== "").length;
  return { totalEntries: entries.length, typedEntries: typed, classicEntries: entries.length - typed };
};

interface Pieces { head: string; rows: Rec[]; tail: Rec }

/** The file's parts: what sits before the entries, one row per entry, what sits after. */
function piecesOf(entity: CanonicalLorebook, now: Date): Pieces {
  const { body } = entity;
  const raw = entity.original?.[ESCROW]?.raw;
  const base = isRecord(raw) ? raw : undefined;
  const rawRows = new Map((Array.isArray(base?.["entries"]) ? (base["entries"] as unknown[]).filter(isRecord) : []).map((r) => [strOr(r["id"], ""), r]));
  const rawCats = new Map((Array.isArray(base?.["categories"]) ? (base["categories"] as unknown[]).filter(isRecord) : []).map((r) => [strOr(r["id"], ""), r]));
  const rawBook = isRecord(base?.["lorebook"]) ? base["lorebook"] : undefined;
  const bookNow = bookRow(body, strOr(rawBook?.["id"], entity.id));
  const bookWas = rawBook ? bookRow(bodyOf(rawBook, [], undefined), strOr(rawBook["id"], entity.id)) : undefined;
  const book: Rec = rawBook ? { ...rawBook } : bookNow;
  if (rawBook && bookWas) for (const [k, v] of Object.entries(bookNow)) if (!deepEq(v, bookWas[k])) book[k] = v;
  const head = JSON.stringify({ ...(base ?? {}), schemaVersion: strOr(base?.["schemaVersion"], COMPENDIUM_SCHEMA), format: FORMAT, exportDate: strOr(base?.["exportDate"], now.toISOString()), lorebook: book, entries: undefined, tree: undefined, nodeConstraints: undefined, categories: undefined, counts: undefined }, null, 2);
  return {
    head: head.slice(0, -2),
    rows: body.entries.map((e) => { const r = rawRows.get(e.id); return r ? mergedRow(e, r) : fullRow(e); }),
    tail: {
      tree: base?.["tree"] ?? null, nodeConstraints: base?.["nodeConstraints"] ?? [],
      categories: (body.categories ?? []).map((c) => { const r = rawCats.get(c.id); return r ? { ...r, ...categoryRow(c) } : categoryRow(c); }),
      counts: counts(body.entries),
    },
  };
}

const footer = (tail: Rec): string => `\n  ],${JSON.stringify(tail, null, 2).slice(1)}\n`;

/** The file as chunks: the header, one chunk per entry, the footer. A Bunraku export carries no tree (Bunraku derives it). */
export async function* compendiumChunks(entity: CanonicalLorebook, now = new Date()): AsyncGenerator<Uint8Array> {
  const { head, rows, tail } = piecesOf(entity, now);
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  yield encode(`${head},\n  "entries": [`);
  for (let i = 0; i < rows.length; i++) yield encode(`${i === 0 ? "" : ","}\n    ${JSON.stringify(rows[i])}`);
  yield encode(footer(tail));
}

function compendiumFile(input: AdapterInput): Rec | null {
  const obj = readJsonObject(input);
  if (!isRecord(obj) || !isRecord(obj["lorebook"]) || !Array.isArray(obj["entries"])) return null;
  return obj["format"] === FORMAT || (typeof obj["schemaVersion"] === "string" && obj["schemaVersion"].startsWith("compendium-")) ? obj : null;
}

const compendium: LorebookAdapter = {
  id: "rolecall-compendium",
  label: "RoleCall compendium export (compendium.json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  detect: (input) => (compendiumFile(input) ? 1 : 0),

  toCanonical(input) {
    const raw = compendiumFile(input);
    if (!raw) throw new Error("rolecall-compendium: not a RoleCall compendium export");
    const body = bodyOf(raw["lorebook"] as Rec, raw["entries"] as unknown[], raw["categories"]);
    return { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: canonicalId(body.name), body, original: { [ESCROW]: { raw } } };
  },

  fromCanonical(entity): AdapterOutput {
    const { head, rows, tail } = piecesOf(entity, new Date());
    return { text: `${head},\n  "entries": [${rows.map((r) => `\n    ${JSON.stringify(r)}`).join(",")}${footer(tail)}`, suggestedExtension: "json" };
  },
};

export default compendium;
