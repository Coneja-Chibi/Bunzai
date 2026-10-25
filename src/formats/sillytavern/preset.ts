/**
 * SillyTavern completion-preset codec. This is also RoleCall's preset
 * wire format: RC exports write the same flat grammar, optionally bundling regex under
 * `extensions.regex_scripts` (+ RC's own `linkedRegexScripts`), so one codec imports both.
 * Lossless: the whole source file rides as the raw twin in original.sillytavern; emit clones the
 * twin and rebuilds only what canonical owns (preset-emit.ts). Bundled regex surfaces through
 * extractRegex, the preset counterpart of the character adapter's extractLorebook seam.
 * Also reads ST's KoboldAI/TextGen/NovelAI sampler sets, system prompts and reasoning templates
 * (st-template-wire.ts); instruct and context templates belong to promptformat.ts.
 */
import type { AdapterInput, AdapterOutput, PresetAdapter } from "../../core/adapter";
import type { CanonicalPreset } from "../../entities/preset/schema";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { detectStPreset, parsedToBody, parseStPreset, toDividerDialect } from "../_shared/st-preset-wire";
import { buildStPreset } from "../_shared/st-preset-emit";
import { SHAPE_SUFFIX, detectTemplateShape, emitTemplate, parseTemplate, templateToBody, toTemplateShape } from "../_shared/st-template-wire";
import { embedRegexIntoPreset, extractRegexFromPreset } from "./preset-regex";
import { isRecord, type Rec } from "../../core/guards";

const FORMAT_ID = "sillytavern-preset";

const presetAdapter: PresetAdapter = {
  id: FORMAT_ID,
  label: "SillyTavern completion preset (flat json)",
  escrowFormatIds: ["sillytavern"],
  outputExtensions: ["json"],
  kind: "preset",
  // coverage: deliberately undeclared until the claims harness audits it (deny-by-absence honest;
  // the marinara preset codec takes the same posture)

  // 0.9: above the regex codec's card-home 0.85 (a preset that bundles regex is still a preset)
  // and level with the character reader, which refuses settings exports outright.
  detect(input: AdapterInput): number {
    const raw = readJsonObject(input);
    return detectStPreset(raw) || detectTemplateShape(raw) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const raw = readJsonObject(input);
    const shape = raw ? detectTemplateShape(raw) : null;
    if (raw && shape) {
      const name = setNameFromFilename(input, typeof raw.name === "string" ? raw.name : "Imported preset") + SHAPE_SUFFIX[shape];
      return {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "preset",
        id: canonicalId(name),
        body: templateToBody(name, parseTemplate(shape, raw)),
        original: { sillytavern: { raw, unmapped: { shape } } },
      };
    }
    if (!raw || !detectStPreset(raw)) {
      throw new Error("sillytavern-preset: not a recognizable completion preset");
    }
    const parsed = parseStPreset(raw);
    // ST preset files carry no name field; the filename is the name every host shows
    const name = setNameFromFilename(input, "Imported preset");
    const body = parsedToBody(name, parsed);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(name),
      body,
      original: {
        sillytavern: {
          raw,
          unmapped: {
            dialect: parsed.dialect,
            ...(parsed.warnings.length > 0 ? { parseWarnings: parsed.warnings } : {}),
          },
        },
      },
    };
  },

  fromCanonical(entity: CanonicalPreset): AdapterOutput {
    const escrow = entity.original?.sillytavern;
    const twin = isRecord(escrow?.raw) ? (escrow.raw as Rec) : undefined;
    const shape = toTemplateShape(escrow?.unmapped?.["shape"]);
    const same = twin && shape ? emitTemplate(shape, twin, entity.body) : null;
    if (same) return { text: JSON.stringify(same, null, 2), suggestedExtension: "json" };
    const dialect = toDividerDialect(escrow?.unmapped?.["dialect"]);
    const out = buildStPreset(entity.body, twin, dialect);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },

  extractRegex(entity: CanonicalPreset): CanonicalRegexSet | null {
    return extractRegexFromPreset(entity.original?.sillytavern?.raw, entity.body.name);
  },

  /**
   * Attach standalone regex sets under `extensions.regex_scripts`, the same field extractRegex reads.
   *
   * ST is one of only TWO platforms where this seam is even correct, and the difference is the
   * attachment MODEL rather than a field name (survey: Vaud-Notes/design/REGEX-FORMATS.md):
   * ST and RoleCall carry rows INSIDE the preset file, so writing them is an emit concern. Lumiverse
   * attaches by `preset_id` ON THE SCRIPT, so its attachment belongs to the regex entity and putting
   * an embedRegex here would invent a shape Lumiverse never reads. Marinara has no preset attachment
   * at all - account-level scripts with per-character targeting. Both correctly have no embedRegex,
   * and that absence is a decision, not an omission.
   */
  embedRegex(entity: CanonicalPreset, sets: readonly CanonicalRegexSet[]): AdapterOutput {
    const base = presetAdapter.fromCanonical(entity);
    return embedRegexIntoPreset(base, sets);
  },
};

export default presetAdapter;
export { presetAdapter };
