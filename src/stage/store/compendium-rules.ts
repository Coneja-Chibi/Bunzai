/**
 * The input check and the merge for a scene's Compendium choices, applied by every
 * ChatStore implementation so they cannot refuse or keep different things. Every range and enum comes from
 * core/compendium/defaults.ts, the one place the Settings controls and the passes read them from.
 */
import type { ChatCompendium, ChatCompendiumBook, ChatCompendiumPatch } from "../contracts/chat-store";
import { ACCESS_LEVELS, BOOK_DISPLAYS, MAX_BOOKS, MAX_GUIDANCE, MAX_ID, MAX_LANGUAGE, MAX_TREE_IDS, INGEST_MODELS, RANGES, RECALL_DETAILS, STANDARDIZE_SOURCES, TREE_DETAILS, TREE_GRANULARITIES, TREE_PLACEMENTS } from "../../core/compendium/defaults";
import { ENTRY_TYPES } from "../../core/compendium/types";
import { isOneOf, isPlainObject, type Rec } from "../../core/guards";
import { checkConnection, checkText, fail } from "./chat-rules";
import { GUIDE_ID } from "./prompting-rules";
import { isWhole } from "./scalar-rules";

type Check = (value: unknown, what: string) => unknown;

const bool: Check = (v, what) => (typeof v === "boolean" ? v : fail(`${what} must be true, false or null`));
const text = (max: number): Check => (v, what) => {
  const t = checkText(v, what);
  return t.length <= max ? t : fail(`${what} must be at most ${max} characters`);
};
const id: Check = (v, what) => (typeof v === "string" && v.length > 0 && v.length <= MAX_ID ? v : fail(`${what} must be 1 to ${MAX_ID} characters`));
const guide: Check = (v, what) => (typeof v === "string" && GUIDE_ID.test(v) ? v : fail(`${what} must be a guide id of 1 to 64 letters, digits, - and _`));
const whole = (range: readonly [number, number]): Check => (v, what) => (isWhole(v, range[0], range[1]) ? v : fail(`${what} must be a whole number from ${range[0]} to ${range[1]}`));
const oneOf = (options: readonly string[]): Check => (v, what) => (isOneOf(v, options) ? v : fail(`${what} must be one of ${options.join(", ")}`));
const types: Check = (v, what) => {
  if (!Array.isArray(v)) return fail(`${what} must be a list or null`);
  if (new Set(v).size !== v.length) fail(`${what} has a duplicate`);
  for (const t of v) if (!isOneOf(t, ENTRY_TYPES)) fail(`${what} has an unknown entry type`);
  return [...v];
};

/** A sparse object's fields: each key a value its check accepts, or null to clear it. `null` values are kept in the result so the merge can clear. */
function checkFields(value: unknown, what: string, fields: Record<string, Check>): Rec {
  if (!isPlainObject(value)) return fail(`${what} must be a plain object or null`);
  const out: Rec = {};
  for (const [key, v] of Object.entries(value)) {
    const check = Object.hasOwn(fields, key) ? fields[key] : undefined;
    if (!check) fail(`${what} has an unknown field: ${key}`);
    if (v !== undefined) out[key] = v === null ? null : check(v, `${what} ${key}`);
  }
  return out;
}

const idList: Check = (v, what) => {
  if (!Array.isArray(v) || v.length > MAX_TREE_IDS) return fail(`${what} must be a list of at most ${MAX_TREE_IDS} ids`);
  return [...new Set(v.map((x) => id(x, `${what} id`)))];
};
const pinMap: Check = (v, what) => {
  if (!isPlainObject(v) || Object.keys(v).length > MAX_TREE_IDS) return fail(`${what} must be an object of at most ${MAX_TREE_IDS} pins`);
  return Object.fromEntries(Object.entries(v).map(([entry, target]) => [id(entry, `${what} entry`) === "__proto__" ? fail(`${what} has a reserved id`) : entry, id(target, `${what} target`)]));
};
const TREE_FIELDS: Record<string, Check> = { locked: idList, forbidden: idList, reorganize: idList, pins: pinMap };
/** A book's tree choices are replaced whole, so an empty list or map is kept as the person left it and nothing else is. */
const BOOK_FIELDS: Record<string, Check> = { access: oneOf(ACCESS_LEVELS), ignoreKeywords: bool, tree: (v, what) => checkFields(v, what, TREE_FIELDS) };
const TREE_BUILD_FIELDS: Record<string, Check> = {
  granularity: (v, what) => (TREE_GRANULARITIES as readonly unknown[]).includes(v) ? v : fail(`${what} must be one of ${TREE_GRANULARITIES.join(", ")}`),
  detail: oneOf(TREE_DETAILS), placement: oneOf(TREE_PLACEMENTS), refine: bool,
};
const RECALL_FIELDS: Record<string, Check> = {
  on: bool, guide, guidance: text(MAX_GUIDANCE), maxEntries: whole(RANGES.maxEntries), minEntries: whole(RANGES.minEntries),
  contextMessages: whole(RANGES.contextMessages), detail: oneOf(RECALL_DETAILS), depth: whole(RANGES.depth), bookDisplay: oneOf(BOOK_DISPLAYS), keywordHints: bool,
};
const FILING_FIELDS: Record<string, Check> = { on: bool, guide, guidance: text(MAX_GUIDANCE), everyN: whole(RANGES.everyN), wait: whole(RANGES.wait), allow: types };
const HISTORIAN_FIELDS: Record<string, Check> = { interval: whole(RANGES.interval), overlap: whole(RANGES.overlap), smartContext: bool };
const INGEST_FIELDS: Record<string, Check> = { continuity: bool, model: oneOf(INGEST_MODELS), chunkTokens: whole(RANGES.chunkTokens), search: bool, facts: bool, narrative: bool };
const STANDARDIZE_FIELDS: Record<string, Check> = { batchSize: whole(RANGES.batchSize), parallelism: whole(RANGES.parallelism), maxRounds: whole(RANGES.maxRounds), autoRetry: bool, modelSource: oneOf(STANDARDIZE_SOURCES) };
const TOP_FIELDS: Record<string, Check> = {
  on: bool, lookup: bool, language: text(MAX_LANGUAGE), writeBook: id, feedClearedAt: (v, what) => (isWhole(v, 0) ? v : fail(`${what} must be a whole number of milliseconds`)),
  model: (v) => checkConnection(v),
  books: (v) => checkBooks(v), recall: (v) => checkFields(v, "recall", RECALL_FIELDS), filing: (v) => checkFields(v, "filing", FILING_FIELDS),
  treeBuild: (v) => checkFields(v, "treeBuild", TREE_BUILD_FIELDS), historian: (v) => checkFields(v, "historian", HISTORIAN_FIELDS),
  ingest: (v) => checkFields(v, "ingest", INGEST_FIELDS),
  standardize: (v) => checkFields(v, "standardize", STANDARDIZE_FIELDS),
};

function checkBooks(value: unknown): Rec {
  if (!isPlainObject(value)) return fail("books must be a plain object or null");
  const out: Rec = {};
  for (const [bookId, patch] of Object.entries(value)) {
    if (id(bookId, "a book id") === "__proto__") fail("a book id is reserved");
    out[bookId] = patch === null ? null : checkFields(patch, "a book", BOOK_FIELDS);
  }
  return out;
}

/** A patch of the scene's Compendium: each key a valid value or null; an empty patch is allowed and changes nothing. */
export function checkCompendium(value: unknown): ChatCompendiumPatch {
  if (!isPlainObject(value)) fail("compendium must be a plain object");
  return checkFields(value, "compendium", TOP_FIELDS) as ChatCompendiumPatch;
}

/** `old` with the null-cleared fields of `patch` removed and the rest replaced; undefined when nothing is left. */
function mergeFields<T extends object>(old: T | undefined, patch: Rec): T | undefined {
  const next: Rec = { ...old };
  for (const [key, v] of Object.entries(patch)) if (v === null) delete next[key]; else next[key] = v;
  return Object.keys(next).length > 0 ? (next as T) : undefined;
}

/** The scene's Compendium after a checked patch; null when nothing is left to keep. */
export function mergeCompendium(old: ChatCompendium | undefined, patch: ChatCompendiumPatch): ChatCompendium | null {
  const { books: bookPatch, recall, filing, treeBuild, historian, ingest, standardize, ...flat } = patch as Rec;
  const merged: Rec = { ...mergeFields<Rec>(old as Rec | undefined, flat) };
  const nested = (key: "recall" | "filing" | "treeBuild" | "historian" | "ingest" | "standardize", p: unknown) => {
    if (p === undefined) return;
    const next = p === null ? undefined : mergeFields<Rec>(old?.[key] as Rec | undefined, p as Rec);
    if (next) merged[key] = next; else delete merged[key];
  };
  nested("recall", recall);
  nested("filing", filing);
  nested("treeBuild", treeBuild);
  nested("historian", historian);
  nested("ingest", ingest);
  nested("standardize", standardize);
  if (bookPatch !== undefined) {
    const books: Record<string, ChatCompendiumBook> = bookPatch === null ? {} : { ...old?.books };
    for (const [bookId, p] of Object.entries((bookPatch ?? {}) as Rec)) {
      const next = p === null ? undefined : mergeFields<ChatCompendiumBook>(books[bookId], p as Rec);
      if (next) books[bookId] = next; else delete books[bookId];
    }
    if (Object.keys(books).length > MAX_BOOKS) fail(`books must hold at most ${MAX_BOOKS}`);
    if (Object.keys(books).length > 0) merged.books = books; else delete merged.books;
  }
  return Object.keys(merged).length > 0 ? (merged as ChatCompendium) : null;
}
