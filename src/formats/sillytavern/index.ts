/**
 * SillyTavern character-card adapter (V1/V2/V3, PNG or JSON).
 * Version detection adapted from RoleCall's parse-v2.ts; field mapping is the shared
 * Tavern mapping (../_shared/tavern-fields). Lossless: the whole original card rides in original.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { embedCharacterBook } from "../_shared/character-book";
import coverage from "./coverage";
import lorebookCodec from "./lorebook";
import quickReplyCodec from "./quickreply";
import regexCodec from "./regex";
import personaCodec from "./persona";
import presetCodec from "./preset";
import promptFormatCodec from "./promptformat";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { isRecord } from "../../core/guards";
import { embedCardPng, getVersion, pngSourceMedia, portraitPngBytes } from "../_shared/png";
import { readCardJson } from "../_shared/card-io";
import { assetsToMedia, applyMediaToTavernData } from "../_shared/assets";
import {
  type TavernData,
  dataToBody,
  applyBodyToData,
  wrapV2,
  wrapV3,
  CARD_SPEC_V2,
  CARD_SPEC_V3,
} from "../_shared/tavern-fields";
import { looksLikeSettingsExport } from "../_shared/kind-markers";

export { embedCharacterJson } from "../_shared/png";

type Variant = "v2" | "v3" | "v1" | "flat";

const VARIANTS: readonly Variant[] = ["v2", "v3", "v1", "flat"];
const V3_ONLY_FIELDS = ["assets", "nickname", "creator_notes_multilingual", "source", "group_only_greetings", "creation_date", "modification_date"] as const;

export interface CharacterCardJsons {
  text: string;
  v2Backfill?: string;
}

/** Read the round-trip variant back out of untyped original, coercing anything unknown to "v2". */
function toVariant(v: unknown): Variant {
  return typeof v === "string" && (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : "v2";
}

interface Detected {
  card: Record<string, unknown>;
  data: TavernData;
  variant: Variant;
}

/** Recognize the card shape and pull out the V2/V3 `data` object. */
function detectCard(json: unknown): Detected | null {
  if (!json || typeof json !== "object") return null;
  const card = json as Record<string, unknown>;
  if (card.spec === CARD_SPEC_V3 && card.data && typeof card.data === "object") {
    return { card, data: card.data as TavernData, variant: "v3" };
  }
  if (card.spec === CARD_SPEC_V2 && card.data && typeof card.data === "object") {
    return { card, data: card.data as TavernData, variant: "v2" };
  }
  if (card.spec === undefined && card.data === undefined && typeof card.name === "string") {
    // Cross-KIND firewall: ST's OTHER exports also carry `name` (+ `extensions`, + even
    // `description` on a standalone character_book), and one of them shipped as a "flat character"
    // once. Any marker of a preset, template, or book disqualifies outright - those files have
    // rightful readers (or an honest refusal), never this branch.
    const looksOtherKind =
      "entries" in card || // worldbook / standalone character_book
      looksLikeSettingsExport(card);
    if (looksOtherKind) return null;
    // `extensions` is NOT a signal here: presets, worldbooks, and standalone character_books all
    // carry it. A flat card must show a field only a character has.
    const looksV2 =
      "alternate_greetings" in card ||
      "system_prompt" in card ||
      "post_history_instructions" in card ||
      "creator_notes" in card ||
      "character_version" in card;
    // A flat/v1 card must carry a real character signal, not just a `name`. This is the cross-kind
    // firewall: an ST worldbook is also `{ name, ... }` json, so without this it false-positives as a
    // v1 character and collides with the lorebook adapter. A lorebook has none of these fields.
    const looksV1 =
      "description" in card ||
      "personality" in card ||
      "scenario" in card ||
      "first_mes" in card ||
      "mes_example" in card;
    if (!looksV2 && !looksV1) return null;
    return { card, data: card as TavernData, variant: looksV2 ? "flat" : "v1" };
  }
  return null;
}

/** Build the normal card and any PNG backfill from one canonical-to-Tavern mapping. */
export function characterCardJsons(entity: CanonicalCharacter, context?: EmitContext): CharacterCardJsons {
  const esc = entity.original?.sillytavern;
  const variant = toVariant(esc?.unmapped?.["variant"]);
  const rawCard = esc?.raw as Record<string, unknown> | undefined;
  const base: TavernData = rawCard && (variant === "v2" || variant === "v3")
    ? { ...(rawCard.data as TavernData) }
    : rawCard ? { ...(rawCard as TavernData) } : {};
  applyBodyToData(base, entity.body);
  applyMediaToTavernData(base, entity.body.media, "sillytavern");
  if (context?.lorebooks !== undefined) embedCharacterBook(base as Record<string, unknown>, context.lorebooks);

  const hasAssets = Array.isArray(base.assets) && base.assets.length > 0;
  const outputVariant: Variant = hasAssets && variant !== "v3" ? "v3" : variant;
  const card = outputVariant === "v3"
    ? rawCard && variant === "v3" ? { ...rawCard, data: base } : wrapV3(base)
    : rawCard && (variant === "v2" || variant === "v3")
      ? { ...rawCard, data: base }
      : variant === "flat" || variant === "v1"
        ? base
        : wrapV2(base);
  const text = JSON.stringify(card, null, 2);
  if (outputVariant !== "v3") return { text };

  const v2Data = { ...base };
  const fields: Record<string, unknown> = {};
  for (const key of V3_ONLY_FIELDS) {
    if (!Object.hasOwn(v2Data, key)) continue;
    fields[key] = v2Data[key];
    delete v2Data[key];
  }
  if (Object.keys(fields).length) {
    const extensions = isRecord(v2Data.extensions) ? { ...v2Data.extensions } : {};
    const vaudeville = isRecord(extensions.vaudeville) ? { ...extensions.vaudeville } : {};
    const escrow = isRecord(vaudeville.escrow) ? { ...vaudeville.escrow } : {};
    const priorFields = isRecord(escrow.fields) ? escrow.fields : {};
    vaudeville.escrow = { ...escrow, version: "3.0", fields: { ...priorFields, ...fields } };
    extensions.vaudeville = vaudeville;
    v2Data.extensions = extensions;
  }
  return { text, v2Backfill: JSON.stringify(wrapV2(v2Data), null, 2) };
}

const adapter: CharacterAdapter = {
  id: "sillytavern",
  label: "SillyTavern character card (v2/v3, png/json)",
  outputExtensions: ["json", "png"],
  kind: "character",
  coverage,
  generic: true, // the generic Tavern/CC reader: its cards chip as "Default", not a platform

  // 0.9, not 1.0: SillyTavern is the generic Tavern reader. More-specific adapters (RoleCall) claim
  // 1.0 on the same card so they win detection and get to map their own extension block.
  detect(input: AdapterInput): number {
    // A PNG-embedded card wins on bytes; otherwise fall through to JSON (text, or non-PNG bytes) -
    // a real .json read carries both, so do NOT stop at the bytes branch (see readCardJson).
    if (input.bytes && getVersion(input.bytes)) return 0.9;
    return detectCard(readCardJson(input)) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    const json = readCardJson(input);
    const det = json ? detectCard(json) : null;
    if (!det) throw new Error("sillytavern: not a recognizable character card");
    const body = dataToBody(det.data);
    body.media = assetsToMedia(det.data.assets); // CCv3 assets[]; a no-op ({}) for V1/V2
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(det.data.name),
      body,
      original: {
        // a PNG card's pixels are authored art: keep the carrier as the raw-bytes twin
        sillytavern: { raw: json, unmapped: { variant: det.variant }, sourceMedia: pngSourceMedia(input.bytes) },
      },
    };
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const output = characterCardJsons(entity, context);
    const { text } = output;

    /**
     * THE FORMAT PEOPLE ACTUALLY TRADE. A SillyTavern card is passed around as a PNG with the card
     * JSON in a tEXt chunk, not as a .json file - so "export as PNG" was the most-asked-for thing
     * this adapter could not do, and the answer was to route people through pygmalion, which writes
     * a different card shape.
     *
     * The card's normal JSON bytes are carried under `ccv3` for V3 and `chara` for other variants;
     * V3 also gets a V2-shaped `chara` backfill for older readers.
     *
     * ASKED FOR EXPLICITLY, unlike pygmalion's branch, which prefers PNG whenever a portrait exists.
     * A .json export must stay a .json export here: this adapter is the generic Tavern reader and
     * most of what it writes is consumed by tools that want the text.
     */
    if (context?.requestedExtension?.toLowerCase() === "png") {
      const portrait = portraitPngBytes(entity.body);
      if (!portrait) {
        throw new Error("sillytavern: PNG export needs the card to have a PNG portrait");
      }
      /**
       * BOTH KEYWORDS FOR A V3 CARD, and getting this wrong is invisible from here.
       *
       * `chara` is the v2 marker every reader knows; `ccv3` is what a v3-aware reader looks for
       * FIRST. Writing only `chara` produced a file that opened everywhere and announced itself as
       * v2 - so a v3 card's own reader would take the v2 path, and the fields v3 added would be read
       * by whatever fallback that app happens to have. The card was right and its label was wrong.
       *
       * Writing both is what the spec's own carriers do: v3 readers find `ccv3`, and older readers
       * find the V2-shaped `chara` backfill. The full V3 serialization stays in `ccv3`.
       */
      return {
        bytes: embedCardPng(portrait, output.v2Backfill ?? text, output.v2Backfill === undefined ? undefined : text),
        suggestedExtension: "png",
      };
    }
    return { text, suggestedExtension: "json" };
  },
};

/** The SillyTavern family's character codec, exported by name for direct importers (tests, bundle). */
export { adapter as characterAdapter };

/** Folders-as-schema: this format family exports every codec it provides (character + world info +
 * regex scripts + completion presets). The regex codec reads the bare `RegexScriptData[]` array
 * (Marinara's Essentials packs) and a card's `extensions.regex_scripts`; a full character card
 * still wins detection (0.9) over the codec's card-home score (0.85), so cards keep importing as
 * characters, and a preset bundling regex wins the same way (preset 0.9 over 0.85). */
export default [adapter, lorebookCodec, regexCodec, quickReplyCodec, personaCodec, presetCodec, promptFormatCodec];
