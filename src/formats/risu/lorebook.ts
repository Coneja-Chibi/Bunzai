/**
 * RisuAI native lorebook codec (standalone `.json` / `.lorebook`, the `vaud convert` lorebook path).
 * Risu's "export lorebook" writes an envelope `{ type: "risu", ver: 1, data: loreBook[] }`; each
 * `loreBook` uses Risu-native field names that DIFFER from CCv3: `key`/`secondkey` are COMMA-joined
 * strings (not arrays), `comment` is the label, `insertorder` is the placement order, `alwaysActive`
 * is the always-on flag, `activationPercent` is the trigger chance, `useRegex` forces regex keys, and
 * `mode`/`folder` carry Risu's entry-folder hierarchy. Verified against RisuAI src (characterCards.ts
 * loreBook<->character_book, process/lorebook.svelte.ts export/importLoreBook) - interop facts only.
 *
 * CONTAINER-INVARIANCE CONTRACT: the SAME Risu lore must canonicalize identically whether it arrives
 * here as a native envelope or embedded in a `.charx` (which routes through _shared/character-book.ts).
 * Risu's own writer equates the two field-for-field (`insertion_order: lore.insertorder`,
 * `constant: lore.alwaysActive`, `name`+`comment: lore.comment`, `keys: lore.key.split(",")`,
 * `use_regex: lore.useRegex`, `case_sensitive` <- `extentions.risu_case_sensitive`, probability <-
 * `extensions.risu_activationPercent`), so every shared field below maps to the exact canonical value
 * character-book.ts produces. `insertorder` therefore lands in `sortOrder` (NOT priority), matching
 * the embedded path. `role` is the one native-richer field (Risu's own `.charx` writer drops it), so
 * it maps here rather than being discarded. Risu's entry-folder hierarchy is FIRST-CLASS: a
 * `mode:"folder"` row becomes a canonical LorebookCategory and a child's `folder` ref becomes
 * `categoryId`, both editable and re-emitted in original row order. `loreCache`/`bookVersion` are
 * runtime cache / bookkeeping and stay original-of-raw, so a same-format round-trip is byte-identical.
 */
import type { LorebookAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalLorebook,
  LorebookBody,
  LorebookCategory,
  LorebookEntry,
  MessageRole,
  Trigger,
} from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { boolFromWire, numOr, strOr } from "../../core/guards";
import { idOrIndex } from "../../core/list-ops";
import { readJsonObject } from "../_shared/card-io";
import {
  characterBookToLorebook,
  isStandaloneCharacterBook,
  keywordToTrigger,
  triggerToKeyword,
} from "../_shared/character-book";
import { ensureUniqueEntryIds, parseRoleName, uniqueEntryId } from "../_shared/lore-enums";
import { overlayFields } from "../_shared/overlay-fields";

/** One Risu-native lore entry. Comma-joined key strings; ST extras live under `extentions` (sic). */
interface LoreBook {
  key?: string;
  secondkey?: string;
  insertorder?: number;
  comment?: string;
  content?: string;
  mode?: "multiple" | "constant" | "normal" | "child" | "folder";
  alwaysActive?: boolean;
  selective?: boolean;
  role?: MessageRole;
  extentions?: { risu_case_sensitive?: boolean };
  activationPercent?: number;
  useRegex?: boolean;
  id?: string;
  /** parent folder id on a child entry ("" / absent = top level); a `mode:"folder"` row IS the folder */
  folder?: string;
  [k: string]: unknown;
}

interface RisuLoreExport {
  type?: unknown;
  ver?: unknown;
  data?: unknown;
  [k: string]: unknown;
}

// -- tolerant coercion (Risu string-coerces numbers/bools in the wild) -----------------------------

const optionalBoolish = (v: unknown): boolean | null =>
  boolFromWire(v) ? true : v === false || v === "false" ? false : null;
const numish = (v: unknown, fallback: number): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

/** Risu joins keywords with commas; split back, trim, drop empties (matches character-book output). */
const splitKeys = (csv: unknown): string[] =>
  typeof csv === "string" ? csv.split(",").map((k) => k.trim()).filter((k) => k.length > 0) : [];

// -- entry: native -> canonical (must equal character-book.ts for shared fields) -------------------

function entryToCanonical(entry: LoreBook, index: number): LorebookEntry {
  const forceRegex = boolFromWire(entry.useRegex);
  const probability = Math.min(100, Math.max(0, numish(entry.activationPercent, 100)));
  // character-book stamps per-trigger probability onto each keyword when the entry chance is not 100;
  // mirror it so an embedded-vs-native diff sees identical triggers.
  const toTriggers = (csv: unknown): Trigger[] =>
    splitKeys(csv).map((k) => {
      const t = keywordToTrigger(k, forceRegex);
      return probability !== 100 ? { ...t, probability } : t;
    });

  const selective = boolFromWire(entry.selective);
  const secondaryTriggers = selective ? toTriggers(entry.secondkey) : [];
  const label = typeof entry.comment === "string" && entry.comment ? entry.comment : `Entry ${index + 1}`;

  return {
    id: idOrIndex(entry.id, index),
    title: label,
    content: typeof entry.content === "string" ? entry.content : "",
    comment: typeof entry.comment === "string" ? entry.comment : null, // Risu writes name AND comment = comment

    enabled: true, // native lore has no per-entry disable flag; Risu always emits enabled:true
    constant: boolFromWire(entry.alwaysActive),

    triggerMode: selective || secondaryTriggers.length > 0 ? "advanced" : "simple",
    triggers: toTriggers(entry.key),
    secondaryTriggers,
    selectiveLogic: "and_any", // native carries no secondary-key logic

    caseSensitive: optionalBoolish(entry.extentions?.risu_case_sensitive),
    matchWholeWords: null, // native has no entry flag (it rides content as an @@ decorator)
    scanDepth: null, // scan depth is character-level in Risu, not per-entry

    position: "character", // native lore has no position/depth; Risu defaults to the character slot
    depth: 4,
    role: parseRoleName(entry.role),

    sortOrder: numish(entry.insertorder, index), // insertorder === CCv3 insertion_order -> sortOrder
    priority: 100, // no eviction-priority axis in native lore

    sticky: 0,
    cooldown: 0,
    delay: 0,

    groupName: null,
    categoryId: typeof entry.folder === "string" && entry.folder ? entry.folder : null,
    groupWeight: 1,

    probability,

    useMemo: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: 0,

    characterFilter: null,

    scanCharacterDescription: false,
    scanCharacterPersonality: false,
    scanUserPersona: false,
    scanScenario: false,

    ignoreBudget: false,

    sideEffects: null,
  };
}

const isFolderRow = (r: LoreBook): boolean => r.mode === "folder";

function bookToCanonical(rows: LoreBook[]): LorebookBody {
  // mode:"folder" rows ARE the folders: they become canonical categories, not content entries.
  // Content entries reference them via `folder` -> categoryId. Original array indices are preserved
  // for the id fallback so the export twin-map stays aligned.
  const categories: LorebookCategory[] = [];
  const entries: LorebookEntry[] = [];
  rows.forEach((row, i) => {
    if (isFolderRow(row)) {
      categories.push({
        id: row.id != null ? String(row.id) : String(i),
        name: strOr(row.comment, `Folder ${categories.length + 1}`),
        sortOrder: categories.length,
      });
    } else {
      entries.push(entryToCanonical(row, i));
    }
  });
  return {
    name: "", // the native envelope carries no book-level name (it lives on the Risu character)
    description: null,
    lorebookType: "character",
    genre: null,
    fandom: null,
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: 0,
    globalRecursion: false,
    tokenBudget: 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: ensureUniqueEntryIds(entries),
    categories: categories.length > 0 ? categories : undefined,
  };
}

// -- entry: canonical -> native, overlaying the original twin so unedited entries re-emit verbatim ----

const allRegex = (ts: Trigger[]): boolean => ts.length > 0 && ts.every((t) => t.isRegex);

/**
 * Re-encode a canonical entry into a native loreBook. With a raw twin (same-format round-trip) we
 * overlay onto its clone and rewrite ONLY fields whose canonical value changed, so an unedited entry
 * re-emits byte-for-byte (comma spacing preserved, `mode`/`folder`/`loreCache` residue untouched).
 * With no twin (cross-format) every field is written from `body` alone.
 */
function entryToWire(e: LorebookEntry, twin: LoreBook | undefined, index: number): LoreBook {
  const base: LoreBook = twin
    ? (structuredClone(twin) as LoreBook)
    : { key: "", secondkey: "", insertorder: 100, comment: "", content: "", mode: "normal", alwaysActive: false, selective: false };
  const decoded = twin ? entryToCanonical(twin, index) : null;
  overlayFields(e, decoded, [
    ["triggers", () => {
      base.key = e.triggers.map(triggerToKeyword).join(", ");
    }],
    ["secondaryTriggers", () => { base.secondkey = e.secondaryTriggers.map(triggerToKeyword).join(", "); }],
    [["triggers", "secondaryTriggers"], () => {
      base.useRegex = allRegex([...e.triggers, ...e.secondaryTriggers]);
      base.selective = e.secondaryTriggers.length > 0;
    }],
    ["title", () => { base.comment = e.title; }], // native `comment` IS the label
    ["content", () => { base.content = e.content; }],
    ["sortOrder", () => { base.insertorder = e.sortOrder; }],
    ["constant", () => { base.alwaysActive = e.constant; }], // leave `mode` to original-of-raw
    ["role", () => { base.role = e.role; }],
    ["probability", () => { base.activationPercent = e.probability; }],
    ["caseSensitive", () => {
      base.extentions = { ...(base.extentions ?? {}), risu_case_sensitive: e.caseSensitive === true };
    }],
    // Folder changes update only the linkage ref; `mode` stays with the twin.
    ["categoryId", () => {
      if (e.categoryId == null && twin?.folder === undefined) return;
      base.folder = e.categoryId ?? "";
    }],
  ]);
  if (twin == null && e.id != null) base.id = e.id;
  return base;
}

function bookToWire(body: LorebookBody, raw: RisuLoreExport | undefined): RisuLoreExport {
  const twinData = Array.isArray(raw?.data) ? (raw!.data as LoreBook[]) : [];
  const entryById = new Map(body.entries.map((e) => [e.id, e]));
  const catById = new Map((body.categories ?? []).map((c) => [c.id, c]));

  // Walk the twin rows IN ORIGINAL ORDER so an unedited file (folders interleaved with entries)
  // re-emits byte-identical: folder rows re-emit from their category (rename lands, residue rides the
  // clone), content rows twin-overlay, rows whose canonical counterpart was deleted drop out.
  const usedEntries = new Set<string>();
  const usedCategories = new Set<string>();
  const seenEntries = new Set<string>();
  const out: LoreBook[] = [];
  twinData.forEach((row, i) => {
    if (isFolderRow(row)) {
      const rid = row.id != null ? String(row.id) : String(i);
      const cat = catById.get(rid);
      if (!cat) return; // category deleted canonically
      usedCategories.add(rid);
      const clone = structuredClone(row) as LoreBook;
      if (clone.comment !== cat.name) clone.comment = cat.name;
      out.push(clone);
    } else {
      const rid = uniqueEntryId(seenEntries, row.id != null ? String(row.id) : String(i));
      seenEntries.add(rid);
      const e = entryById.get(rid);
      if (!e) return; // entry deleted canonically
      usedEntries.add(rid);
      out.push(entryToWire(e, row, i));
    }
  });
  // canonical additions with no twin: entries first, then minimal valid folder rows
  for (const e of body.entries) if (!usedEntries.has(e.id)) out.push(entryToWire(e, undefined, 0));
  for (const c of body.categories ?? []) {
    if (usedCategories.has(c.id)) continue;
    out.push({ key: "", secondkey: "", insertorder: 100, comment: c.name, content: "", mode: "folder", alwaysActive: false, selective: false, id: c.id });
  }

  return {
    ...(raw ? structuredClone(raw) : {}),
    type: "risu",
    ver: numOr(raw?.ver, 1),
    data: out,
  };
}

// -- adapter ---------------------------------------------------------------------------------------

/** Parse untrusted json into the Risu lore envelope, or null if it is not one. */
function readExport(input: AdapterInput): RisuLoreExport | null {
  const obj = readJsonObject(input) as RisuLoreExport | null;
  if (!obj || obj.type !== "risu" || !Array.isArray(obj.data)) return null;
  return obj;
}

const risuLorebook: LorebookAdapter = {
  id: "risu-lorebook",
  label: "RisuAI lorebook (native export json)",
  outputExtensions: ["json"],
  kind: "lorebook",

  // 1.0: the `{ type: "risu", ver, data }` envelope is unambiguous.
  // 0.75: standalone CCv3/character_book extract (card.character_book saved alone).
  detect(input: AdapterInput): number {
    if (readExport(input)) return 1;
    if (isStandaloneCharacterBook(readJsonObject(input))) return 0.75;
    return 0;
  },

  toCanonical(input: AdapterInput): CanonicalLorebook {
    const raw = readExport(input);
    if (raw) {
      const body = bookToCanonical(raw.data as LoreBook[]);
      return {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: canonicalId(body.name),
        body,
        original: { "risu-lorebook": { raw } },
      };
    }
    const cbook = readJsonObject(input);
    if (!isStandaloneCharacterBook(cbook)) {
      throw new Error("risu-lorebook: not a Risu lorebook export");
    }
    // Card-extracted character_book: same field map as embedded .charx path.
    const body = characterBookToLorebook(cbook);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: canonicalId(body.name),
      body,
      original: {},
    };
  },

  fromCanonical(entity: CanonicalLorebook): AdapterOutput {
    const raw = entity.original?.["risu-lorebook"]?.raw as RisuLoreExport | undefined;
    const out = bookToWire(entity.body, raw);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default risuLorebook;
