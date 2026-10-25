/**
 * The one default and the one range for every Compendium setting. The store's check,
 * the Settings controls and the recall and filing passes all read these, so they cannot disagree (RoleCall's
 * defaults disagreed in four places, 04b section 4 F10). The scene stores only what the person changed;
 * `resolveCompendium` fills in the rest on read and never writes.
 *
 * Ranges and RoleCall defaults come from its Settings page (`CompendiumSettings.tsx`, `lib/lorebook/tree.ts:432-446`).
 * Compendium defaults (04b section 9): filing waits for the next message (wait 1), books are read only until
 * the person grants write, and recall and filing each take an optional Guide.
 */
import type { ChatCompendium, ChatCompendiumFiling, ChatCompendiumHistorian, ChatCompendiumIngest, ChatCompendiumRecall, ChatCompendiumStandardize, ChatCompendiumTreeBuild, ChatConnection, CompendiumAccess } from "../../stage/contracts/chat-settings-types";
import { ENTRY_TYPES, type EntryType } from "./types";

export const ACCESS_LEVELS: readonly CompendiumAccess[] = ["off", "read_only", "read_write", "write_only"];
export const RECALL_DETAILS = ["names", "taglines", "preview"] as const;
export const BOOK_DISPLAYS = ["unified", "per_book"] as const;
export const TREE_GRANULARITIES = [0, 1, 2, 3, 4] as const;
export const TREE_DETAILS = ["names", "lite", "full"] as const;
export const TREE_PLACEMENTS = ["auto", "sequential", "parallel"] as const;

/** Inclusive whole-number ranges. */
export const RANGES = {
  maxEntries: [1, 30],
  minEntries: [0, 20],
  contextMessages: [5, 100],
  depth: [1, 20],
  everyN: [1, 10],
  wait: [0, 5],
  interval: [0, 100],
  overlap: [0, 40],
  chunkTokens: [1000, 32000],
  batchSize: [1, 500],
  parallelism: [1, 20],
  maxRounds: [1, 20],
} as const;
export const INGEST_MODELS = ["compendium", "scene"] as const;
export const STANDARDIZE_SOURCES = ["compendium", "scene"] as const;

/** Longest guidance text, language name, and book id the store keeps. */
export const MAX_GUIDANCE = 4_000;
export const MAX_LANGUAGE = 80;
export const MAX_BOOKS = 200;
export const MAX_ID = 200;
/** The most ids one list of a book's tree choices holds, and the most pins. */
export const MAX_TREE_IDS = 400;

export interface ResolvedCompendium {
  on: boolean;
  /** Narrator explore tool. */
  lookup: boolean;
  model: ChatConnection | undefined;
  language: string;
  recall: Required<Omit<ChatCompendiumRecall, "guide">> & { guide: string | undefined };
  filing: Required<Omit<ChatCompendiumFiling, "guide" | "allow">> & { guide: string | undefined; allow: readonly EntryType[] };
  treeBuild: Required<ChatCompendiumTreeBuild>;
  historian: Required<ChatCompendiumHistorian>;
  ingest: Required<ChatCompendiumIngest>;
  standardize: Required<ChatCompendiumStandardize>;
}

export const COMPENDIUM_DEFAULTS = {
  on: false,
  lookup: false,
  access: "read_only" as CompendiumAccess,
  ignoreKeywords: false,
  recall: { on: true, guidance: "", maxEntries: 10, minEntries: 0, contextMessages: 20, detail: "taglines", depth: 2, bookDisplay: "unified", keywordHints: true },
  filing: { on: true, guidance: "", everyN: 1, wait: 1 },
  treeBuild: { granularity: 0, detail: "lite", placement: "auto", refine: false },
  historian: { interval: 20, overlap: 10, smartContext: false },
  ingest: { continuity: true, model: "compendium", chunkTokens: 6000, search: true, facts: true, narrative: true },
  /** RoleCall's: 5 entries a batch, 5 batches at once, 8 rounds a batch (`BentoDashboard.tsx:227-234`), retry failures once, the Compendium's model (`CompendiumSettings.tsx:737-740`). */
  standardize: { batchSize: 5, parallelism: 5, maxRounds: 8, autoRetry: true, modelSource: "compendium" },
} as const;

/** Every setting with its default filled in. Pure: a scene with nothing saved resolves to the defaults, and reading never writes. */
export function resolveCompendium(saved: ChatCompendium | undefined): ResolvedCompendium {
  const d = COMPENDIUM_DEFAULTS;
  return {
    on: saved?.on ?? d.on,
    lookup: saved?.lookup ?? d.lookup,
    model: saved?.model,
    language: saved?.language ?? "",
    recall: { ...d.recall, ...stripUndefined(saved?.recall), guide: saved?.recall?.guide } as ResolvedCompendium["recall"],
    filing: { ...d.filing, ...stripUndefined(saved?.filing), guide: saved?.filing?.guide, allow: saved?.filing?.allow ?? ENTRY_TYPES } as ResolvedCompendium["filing"],
    treeBuild: { ...d.treeBuild, ...stripUndefined(saved?.treeBuild) } as ResolvedCompendium["treeBuild"],
    historian: { ...d.historian, ...stripUndefined(saved?.historian) } as ResolvedCompendium["historian"],
    ingest: { ...d.ingest, ...stripUndefined(saved?.ingest) } as ResolvedCompendium["ingest"],
    standardize: { ...d.standardize, ...stripUndefined(saved?.standardize) },
  };
}

const stripUndefined = <T extends object>(value: T | undefined): Partial<T> => Object.fromEntries(Object.entries(value ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;

/** What the Compendium may do with a book in this scene: the person's choice, else read only. */
export const accessOf = (saved: ChatCompendium | undefined, bookId: string): CompendiumAccess => saved?.books?.[bookId]?.access ?? COMPENDIUM_DEFAULTS.access;

export const canRead = (access: CompendiumAccess): boolean => access === "read_only" || access === "read_write";
export const canWrite = (access: CompendiumAccess): boolean => access === "read_write" || access === "write_only";

/** The book filing writes into by default: the saved one, only while it still allows writes; otherwise nothing (the person must pick one). */
export function writeBookOf(saved: ChatCompendium | undefined): string | undefined {
  const id = saved?.writeBook;
  return id !== undefined && canWrite(accessOf(saved, id)) ? id : undefined;
}
