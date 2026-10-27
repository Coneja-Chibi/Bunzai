/**
 * The scene's own setting shapes, split from chat-store.ts for the
 * file-size cap. chat-store.ts re-exports them, so callers keep importing from there.
 */
import type { EntryType } from "../../core/compendium/types";
import type { PresetSamplers } from "../../entities/preset/schema";
import type { ReasoningCapture } from "../../core/reasoning-capture";
import type { SceneGeneration } from "../params/scene";

/** A saved Kit connection by id, and the model on it the scene sends to (spec rule 18). */
export interface ChatConnection {
  id: string;
  model: string;
}

/**
 * A library preset a scene follows, plus the scene's own overrides (spec rule 19). The scene follows
 * edits to the library preset itself; `toggles` and `samplers` are the scene's own layer on top,
 * applied over the library preset's block switches and sampler values.
 */
export interface ChatPreset {
  /** The writing setup's kind (a preset, a Script Sheet: core/writing.ts). */
  kind: string;
  /** Its library id. The store never checks it against the library (D18). */
  id: string;
  /** Preset block id to on/off, overriding the block's own switch. */
  toggles: Record<string, boolean>;
  /** Sampler overrides from the scene's quick sampler bar, over the library preset's own values. */
  samplers: ChatPresetSamplers;
}

/**
 * The sampler fields a scene may override (names match PresetSamplers, entities/preset/schema.ts), and
 * the scene's own generation parameters and Custom Request Parameters (stage/params/scene.ts), which
 * no library preset carries.
 */
export type ChatPresetSamplers = Partial<
  Pick<
    PresetSamplers,
    | "temperature"
    | "topP"
    | "topK"
    | "topA"
    | "minP"
    | "frequencyPenalty"
    | "presencePenalty"
    | "repetitionPenalty"
    | "maxTokens"
    | "maxContext"
    | "promptPostProcessing"
    | "contextMode"
    | "maxMessages"
  >
> &
  SceneGeneration;

/** The scene's own lorebook choices (spec rule 20). Book ids are library ids; the store never checks them (D18). */
export interface ChatLore {
  /** Library books added to this scene, in the order they were added. No duplicates. */
  added: string[];
  /** Books switched off for this scene, whatever their source (added, the character's, the persona's). No duplicates. */
  off: string[];
}

/** The scene's switched-on Props (spec rule 21). Ids name entries in the Props registry
 * (src/ui/apps/scenes/props/registry.ts); the store never checks them against it (D18). */
export interface ChatProps {
  /** Registered prop ids switched on for this scene. No duplicates, at most 50, each 1 to 64 characters of [a-z0-9-]. */
  on: string[];
}

/** The person's edits of the opening message, one per greeting index, as RoleCall's first_message_override (spec rule 34). */
export interface ChatOpening {
  /** At most 64, one per index (0 to 63), each the trimmed, non-blank text that replaces that greeting. */
  edits: { index: number; text: string }[];
}

/** The scene note, RoleCall's author_note fields (spec rule 37): where it goes, how deep, and how often. */
export interface ChatNote {
  /** At most 10,000 characters; macros are expanded at assembly. Blank means no note. */
  text: string;
  /** `after_scenario` after the leading system prompts, or `in_chat` at `depth` in the history. */
  position: "after_scenario" | "in_chat";
  /** In-chat only: a whole number 0 to 10. */
  depth: number;
  /** 1 every turn, 2 to 4 every Nth, 0 never: a whole number 0 to 4. */
  frequency: number;
}

/** What the Prompting wing keeps on a scene (spec rule 37): the guides switched on, in order, the scene note, and the runtime switches: Last Message as User, Narrator Tool Access and Max tool rounds. */
export interface ChatPrompting {
  /** Guide ids, in the order they were switched on. No duplicates, at most 50, each 1 to 64 characters of [A-Za-z0-9_-]. */
  guides?: string[];
  note?: ChatNote;
  /** RoleCall's forceLastMessageUser: re-tag the request's final message as a user turn. Kept only while true. */
  lastAsUser?: boolean;
  /** RoleCall's Narrator Tool Access (stageSettings.agentLoopEnabled): the writing model may call first-party read-only tools while it writes. Kept only while true; off means it receives no tools. */
  toolAccess?: boolean;
  /** RoleCall's Max tool rounds (agentLoopMaxTurns): a whole number 1 to 20; absent means 8. */
  toolRounds?: number;
  /** The library tools (entities/tool) the writing model may also call while Tool Access is on, in order. No duplicates, at most 20 ids. */
  tools?: string[];
  /** RoleCall's Reasoning Effort (sampler reasoning_effort): how hard the model thinks before writing. Absent means Auto, which sends nothing. */
  reasoningEffort?: ChatReasoningEffort;
  /** RoleCall's Start Reply With (chat-level prefill): text every reply starts with, over the preset's own prefill. At most 2,000 characters; blank is cleared. */
  prefill?: string;
  /** Where the Start Reply With text lands when it is not the assistant's: a trailing user hint or system note. Absent means assistant. */
  prefillRole?: "user" | "system";
  /** RoleCall's "Let the model see its old thinking" (keep_inline_thinking_tags): earlier replies are sent with their thinking in them. Kept only while true; off strips it from the history the model reads. */
  keepThinking?: boolean;
  /** RoleCall's Reasoning continuity (roundtrip_native_reasoning): earlier replies' provider reasoning is sent back, to the model that wrote it and only where the connection takes it. Kept only while true. */
  continuity?: boolean;
  /** RoleCall's Show Prefill in Chat: a reply shows the Start Reply With text it was written after. Kept only while true. */
  showPrefill?: boolean;
  /** RoleCall's Catch thinking: Only these or Off, with the lists kept whole. Absent means Auto. */
  capture?: ReasoningCapture;
}

/** The Reasoning Effort levels a scene may send; Auto is the absence of one. */
export type ChatReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

/** A change to a scene's prompting: a key given replaces it, a key given as null clears it, a key left out stays. */
export type ChatPromptingPatch = { [K in keyof ChatPrompting]?: ChatPrompting[K] | null };

/**
 * The one picture a scene shows behind its messages (spec rule 36): a Sprite pack and one item in it, plus the
 * overlay darkness over the picture. The store never checks the pack or item against the library (D18); a pack or item
 * that is gone is the scene's "backdrop is gone" state.
 */
export interface ChatBackdrop {
  /** A library pack's id. */
  pack: string;
  /** The id of one item in that pack. */
  item: string;
  /** Overlay darkness from 0 to 1, as RoleCall's backgroundOverlayOpacity. Absent means the default (0.6). */
  dim?: number;
  /** Playback rate of a video backdrop from 0.25 to 2, as RoleCall's videoPlaybackRate slider. Absent means 1. */
  rate?: number;
  /** Blur over the picture in pixels from 0 to 20. Absent means none. */
  blur?: number;
}

/** What the Compendium may do with one book (spec rule 38): RoleCall's Disabled, Read-Only, Read + Write and Write-Only. Absent means `read_only`. */
export type CompendiumAccess = "off" | "read_only" | "read_write" | "write_only";

/**
 * The person's tree choices for one book (spec rule 38; RoleCall's lock, forbid, reorganize and move). Each id names a tree
 * node or an entry. Locked keeps it where the last build put it, forbidden never lets it exist (a branch is dissolved into
 * its parent, an entry is left unsorted), reorganize is one build only and clears itself, and a pin files an entry under
 * another entry (key: the entry moved, value: the entry it goes under). They live here, never inside the book.
 */
export interface ChatCompendiumTreeConstraints {
  locked?: string[];
  forbidden?: string[];
  reorganize?: string[];
  pins?: Record<string, string>;
}

/** The scene's own choices for one attached book (spec rule 38). The book itself stays in the library; the store never checks the id (D18). */
export interface ChatCompendiumBook {
  access?: CompendiumAccess;
  tree?: ChatCompendiumTreeConstraints;
  /** RoleCall's "Ignore keyword matches": the book is used through recall alone. Absent means off. */
  ignoreKeywords?: boolean;
}

/** What the Compendium recalls before a reply (spec rule 38). Every field is sparse: absent means the default in core/compendium/defaults.ts. */
export interface ChatCompendiumRecall {
  on?: boolean;
  /** A Guide (the library's, by id) whose text steers the pass; absent means none. */
  guide?: string;
  guidance?: string;
  maxEntries?: number;
  minEntries?: number;
  contextMessages?: number;
  detail?: "names" | "taglines" | "preview";
  depth?: number;
  bookDisplay?: "unified" | "per_book";
  keywordHints?: boolean;
}

/** What the Compendium files after a reply (spec rule 38). `wait` counts the person's messages to hold back: 1 files a reply when the next message is sent, 0 files it right away. */
export interface ChatCompendiumFiling {
  on?: boolean;
  guide?: string;
  guidance?: string;
  everyN?: number;
  wait?: number;
  /** The entry types it may file; absent means all eleven, an empty list means none. */
  allow?: EntryType[];
}

/** How the tree is built (spec rule 38; RoleCall "Tree building"): 0 is Auto, 1 to 4 are Minimal to Extensive. Absent means the default in core/compendium/defaults.ts. */
export interface ChatCompendiumTreeBuild {
  granularity?: 0 | 1 | 2 | 3 | 4;
  detail?: "names" | "lite" | "full";
  placement?: "auto" | "sequential" | "parallel";
  /** RoleCall's "Refine entries during build" (`tv_tree_refine_entries`): the model may split and merge the classic entries of each branch it built. Off by default. */
  refine?: boolean;
}

/** How often the Historian summarizes (spec rule 38; RoleCall "Historian summaries"): every `interval` of the person's turns, 0 being off, reading `overlap` messages back from where the last summary ended. `smartContext` (RoleCall "Summary-aware context truncation") sends the Compendium's recaps in place of the oldest messages they cover. */
export interface ChatCompendiumHistorian {
  interval?: number;
  overlap?: number;
  smartContext?: boolean;
}

/** How Import chat history reads a scene (spec rule 38; RoleCall "Import chat history"): `continuity` tells each chunk what the ones before filed, `model` is the Compendium's own (or the scene's when unset) or the scene's, `chunkTokens` is how much of the chat one call sees, and the three phases are what a call may do (Search shows it the existing entries, Facts files typed entries, Narrative files recaps and plot overviews). */
export interface ChatCompendiumIngest {
  continuity?: boolean;
  model?: "compendium" | "scene";
  chunkTokens?: number;
  search?: boolean;
  facts?: boolean;
  narrative?: boolean;
}

/** What a Standardize run reads (spec rule 38): the Dashboard banner's controls and Settings > Advanced write these; the run resolves them. `modelSource` is RoleCall's "TV Sidecar" (the Compendium's model) or "Narrator" (the scene's own). */
export interface ChatCompendiumStandardize {
  batchSize?: number;
  parallelism?: number;
  /** The most model rounds one batch may take (RoleCall's Tool Loop Cap). */
  maxRounds?: number;
  autoRetry?: boolean;
  modelSource?: "compendium" | "scene";
}

/** A scene's Compendium choices (spec rule 38), sparse: only what the person changed is kept, defaults are resolved on read. */
export interface ChatCompendium {
  on?: boolean;
  /** The Kit connection and model the Compendium passes use; absent means the scene's own. */
  model?: ChatConnection;
  /** Blank follows the narrator's language. */
  language?: string;
  /** Epoch ms the person last pressed Clear feed in Activity: rows older than this are hidden, the receipts stay (04b F25). */
  feedClearedAt?: number;
  /** RoleCall's "Narrator explore tool" (tv_during_gen_search): the narrator may search the books mid-reply, when Narrator Tool Access is on too. Absent means off. */
  lookup?: boolean;
  /** The one book the Compendium files into by default; it counts only while that book allows writes. */
  writeBook?: string;
  books?: Record<string, ChatCompendiumBook>;
  recall?: ChatCompendiumRecall;
  filing?: ChatCompendiumFiling;
  treeBuild?: ChatCompendiumTreeBuild;
  historian?: ChatCompendiumHistorian;
  ingest?: ChatCompendiumIngest;
  standardize?: ChatCompendiumStandardize;
}

type Patched<T> = { [K in keyof T]?: T[K] | null };

/** A change to a scene's Compendium: a key given replaces it, null clears it, a key left out stays; `books`, `recall` and `filing` merge field by field. */
export type ChatCompendiumPatch = Patched<Omit<ChatCompendium, "books" | "recall" | "filing" | "treeBuild" | "historian" | "ingest" | "standardize">> & {
  books?: Record<string, Patched<ChatCompendiumBook> | null> | null;
  recall?: Patched<ChatCompendiumRecall> | null;
  filing?: Patched<ChatCompendiumFiling> | null;
  treeBuild?: Patched<ChatCompendiumTreeBuild> | null;
  historian?: Patched<ChatCompendiumHistorian> | null;
  ingest?: Patched<ChatCompendiumIngest> | null;
  standardize?: Patched<ChatCompendiumStandardize> | null;
};
