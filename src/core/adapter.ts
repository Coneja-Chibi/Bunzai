/** Shared format-adapter contracts that connect drop-in codecs to the canonical model. */
import type { AnyKindEntity, KindId } from "../generated/kinds";
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { CanonicalPreset } from "../entities/preset/schema";
import type { CanonicalRegexSet } from "../entities/regex/schema";
import type { CoverageDecl } from "./coverage";
import type { FormatId } from "./canonical";
import type { SerializeReport } from "./reports";

/** Raw input handed to an adapter. Binary formats use bytes; text/json use text. */
export interface AdapterInput {
  bytes?: Uint8Array;
  text?: string;
  filename?: string;
}

/** What an adapter emits when writing a canonical entity out to its format. */
export interface AdapterOutput {
  bytes?: Uint8Array;
  text?: string;
  suggestedExtension: string;
  /** Named field-loss accounting attached by the conversion/export boundary. */
  report?: SerializeReport;
}

/**
 * Cross-entity context handed to fromCanonical at bundle-export time. Resolved by the layer that
 * owns the registry (it holds every entity), never by the core. A character adapter for a format
 * that embeds knowledge (CCv2/v3 character_book) re-embeds `lorebooks`; adapters that do not simply
 * ignore it. Optional, so a `(entity) => out` adapter stays assignable.
 */
export interface EmitContext {
  lorebooks?: CanonicalLorebook[];
  /**
   * Caller-requested output extension (no leading dot), e.g. "json" or "charx".
   * Multi-container adapters honor this when set; omit to keep source-container defaults.
   */
  requestedExtension?: string;
}

/** Fields every adapter carries, whatever entity kind it reads and writes. */
interface AdapterBase {
  id: FormatId;
  label: string;
  /** Source-escrow keys this adapter owns when its wire id and escrow family id differ. */
  escrowFormatIds?: readonly FormatId[];
  /** File extensions this adapter writes (no dot), so the CLI can pick a target by output name. */
  outputExtensions: string[];
  /** 0..1 confidence that this adapter can read the given input. */
  detect(input: AdapterInput): number;
  /** True on Bunraku's own storage format(s): still import/exportable, but never offered as an
   * external "publish to" platform (the truth lives here, with the format, not in any UI list). */
  native?: boolean;
  /** True on the GENERIC reader of a family (the plain Tavern/CC card): cards it claims carry no
   * platform-specific fields, so the UI's card-type chip says "Default" instead of a platform. */
  generic?: boolean;
  /** Which canonical body paths this format's wire carries (the editor lens's ground truth; the
   * format folder owns the claim - src/formats/<id>/coverage.ts). Absent = lens shows the platform
   * tab marked "coverage not declared" and dims nothing (deny-by-absence stays honest). */
  coverage?: CoverageDecl;
  /**
   * When false, coverage still powers export honesty but the editor platform strip omits this
   * format (export-only / legacy wire, not a separate host product). Default true when coverage set.
   */
  lens?: boolean;
}

type EntityFor<K extends KindId> = Extract<AnyKindEntity, { kind: K }>;

/**
 * The contract a format plugin implements for one kind: read a file into the canonical piece (stashing originals and
 * unmapped fields in `original`), and write a canonical piece back out, re-emitting its own original for round-trip.
 */
export interface KindAdapter<K extends KindId> extends AdapterBase {
  kind: K;
  toCanonical(input: AdapterInput): EntityFor<K>;
  fromCanonical(entity: EntityFor<K>, context?: EmitContext): AdapterOutput;
}

/** Character cards, which may carry an embedded lorebook in their own dialect. */
export interface CharacterAdapter extends KindAdapter<"character"> {
  /**
   * Optional: pull an embedded lorebook whose dialect is NOT a CCv2/v3 `character_book` (which the
   * shared extractor handles), e.g. Agnai's native `characterBook` MemoryBook. The bundle layer calls
   * this instead of the default CCv3 extraction when present. A tolerant reader: return null when the
   * card carries no embedded book. Keeps each format's dialect in its own folder (layers point inward).
   */
  extractLorebook?(entity: CanonicalCharacter): CanonicalLorebook | null;
}

/** Presets, which may carry regex sets bundled inside the export. */
export interface PresetAdapter extends KindAdapter<"preset"> {
  /**
   * Optional: pull regex scripts BUNDLED inside the preset export (ST/RC ride them under
   * `extensions.regex_scripts`). The bundle layer surfaces the set as a related entity beside the
   * preset, the same seam as CharacterAdapter.extractLorebook. Tolerant: null when none ride.
   */
  extractRegex?(entity: CanonicalPreset): CanonicalRegexSet | null;
  /**
   * Optional: the INVERSE of extractRegex - write regex sets back down into the preset's own bundle
   * field on emit, so a standalone set can be attached to a preset the same way a lorebook is
   * re-embedded into a character by EmitContext.
   *
   * ADDITIVE BY CONTRACT. An empty array (or no call at all) must leave the emitted bytes exactly as
   * `fromCanonical` produced them, because preset bundling was measured as additive and a preset
   * carrying no regexes must not start differing from its bare form. `emit-bundle.test.ts` holds that
   * property; do not relax it into "usually the same".
   */
  embedRegex?(entity: CanonicalPreset, sets: readonly CanonicalRegexSet[]): AdapterOutput;
}

export type LorebookAdapter = KindAdapter<"lorebook">;
export type PersonaAdapter = KindAdapter<"persona">;
export type RegexAdapter = KindAdapter<"regex">;
export type PackAdapter = KindAdapter<"pack">;
export type QuickReplyAdapter = KindAdapter<"quickreply">;
export type PromptFormatAdapter = KindAdapter<"promptformat">;

/**
 * The contract every format plugin implements, discriminated by `kind`: one KindAdapter per kind in the generated kind
 * seam, with the character and preset extras. Adding a format = adding one of these; adding a kind = its
 * src/entities/<kind>/ folder and `bun run kinds`, nothing here. Core NEVER imports adapters directly; a registry wires
 * them to the CLI and app. A converter narrows on `kind` (guard src.kind === target.kind) before it hands an entity to
 * fromCanonical, so no unsafe cross-kind call is representable.
 */
export type FormatAdapter = {
  [K in KindId]: K extends "character" ? CharacterAdapter : K extends "preset" ? PresetAdapter : KindAdapter<K>;
}[KindId];
