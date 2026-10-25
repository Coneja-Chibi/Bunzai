/**
 * RoleCall preset codec. RC exports the flat SillyTavern completion-preset grammar PLUS its own
 * top-level keys - the real fingerprint, read from a real export: `macro_engine_yaml` (the RC
 * macro engine's YAML, sealed data, never executed), `choice_groups` (the walkthrough the
 * canonical PresetChoice shape was distilled from), `readme`, `name`, `linkedRegexScripts` under
 * extensions on newer routes. A bare extensions.regex_scripts bundle is NOT a fingerprint -
 * SillyTavern presets bundle regex too (platform-owner correction).
 *
 * Mapping: shared st-preset wire for the ST half; name/readme/choice_groups map natively
 * (body.name / body.description / body.choices); macro_engine_yaml and every other RC key ride
 * the raw twin and re-emit untouched. Emit is twin-diff: RC keys are rewritten only when the
 * canonical value actually drifted, so an unedited import round-trips deep-equal.
 */
import type { AdapterInput, AdapterOutput, PresetAdapter } from "../../core/adapter";
import type {
  CanonicalPreset,
  PresetBody,
  PresetChoice,
  PresetChoiceOption,
  PresetChoiceType,
} from "../../entities/preset/schema";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { buildStPreset } from "../_shared/st-preset-emit";
import { detectStPreset, parsedToBody, parseStPreset, toDividerDialect } from "../_shared/st-preset-wire";
import { embedRegexIntoPreset, extractRegexFromPreset } from "../sillytavern/preset-regex";
import { deepEq, isRecord, optStr, type Rec } from "../../core/guards";

const FORMAT_ID = "rolecall-preset";

/** The RC fingerprint: any key only RoleCall's exporter writes onto the flat ST grammar. */
export function isRolecallPresetExport(json: unknown): json is Rec {
  if (!isRecord(json) || !detectStPreset(json)) return false;
  if (typeof json.macro_engine_yaml === "string") return true;
  if (Array.isArray(json.choice_groups)) return true;
  const ext = json.extensions;
  return isRecord(ext) && Array.isArray(ext.linkedRegexScripts);
}

const CHOICE_TYPES: readonly PresetChoiceType[] = ["one", "many", "toggle", "input"];
/** RoleCall's own names for the two select types; the canonical names are accepted too. */
const RC_TYPE: Readonly<Record<string, PresetChoiceType>> = { select_one: "one", select_many: "many" };
const WIRE_TYPE: Readonly<Partial<Record<PresetChoiceType, string>>> = { one: "select_one", many: "select_many" };

/** One wire choice_group -> canonical PresetChoice (the shape canonical was distilled FROM). */
function choiceFromWire(c: Rec): PresetChoice {
  const type = RC_TYPE[String(c.type)] ?? (CHOICE_TYPES.includes(c.type as PresetChoiceType) ? (c.type as PresetChoiceType) : "one");
  const options: PresetChoiceOption[] = (Array.isArray(c.options) ? c.options : [])
    .filter(isRecord)
    .map((o) => {
      const opt: PresetChoiceOption = { id: optStr(o.id) ?? "", label: optStr(o.label) ?? "" };
      const value = optStr(o.value);
      if (value !== undefined) opt.value = value;
      const desc = optStr(o.description);
      if (desc !== undefined) opt.description = desc;
      if (Array.isArray(o.prompts)) opt.enablesPrompts = o.prompts.filter((p): p is string => typeof p === "string");
      return opt;
    });
  const choice: PresetChoice = { id: optStr(c.id) ?? "", label: optStr(c.label) ?? "", type, options };
  const readme = optStr(c.description) ?? optStr(c.readme);
  if (readme !== undefined) choice.readme = readme;
  const key = optStr(c.key) ?? optStr(c.variableName);
  if (key !== undefined) choice.key = key;
  if (typeof c.default === "string" || typeof c.default === "boolean" || Array.isArray(c.default)) {
    choice.default = c.default as PresetChoice["default"];
  }
  const placeholder = optStr(c.placeholder);
  if (placeholder !== undefined) choice.placeholder = placeholder;
  if (Array.isArray(c.suggestions)) {
    choice.suggestions = c.suggestions.filter((s): s is string => typeof s === "string");
  }
  if (typeof c.min === "number") choice.min = c.min;
  const separator = optStr(c.separator);
  if (separator !== undefined) choice.separator = separator;
  if (typeof c.sortOrder === "number") choice.sortOrder = c.sortOrder;
  if (type === "toggle" && Array.isArray(c.prompts)) choice.extras = { prompts: c.prompts.filter((p): p is string => typeof p === "string") };
  return choice;
}

/** Canonical choice -> wire choice_group (the inverse of choiceFromWire, sparse like the source). */
function choiceToWire(c: PresetChoice): Rec {
  const out: Rec = { id: c.id, label: c.label, type: WIRE_TYPE[c.type] ?? c.type };
  if (c.type === "toggle" && Array.isArray(c.extras?.["prompts"])) out.prompts = c.extras["prompts"];
  if (c.readme !== undefined) out.description = c.readme;
  if (c.key !== undefined) out.key = c.key;
  if (c.default !== undefined) out.default = c.default;
  if (c.placeholder !== undefined) out.placeholder = c.placeholder;
  if (c.suggestions !== undefined) out.suggestions = c.suggestions;
  if (c.min !== undefined) out.min = c.min;
  if (c.separator !== undefined) out.separator = c.separator;
  if (c.sortOrder !== undefined) out.sortOrder = c.sortOrder;
  if (c.options.length > 0) {
    out.options = c.options.map((o) => {
      const w: Rec = { id: o.id, label: o.label };
      if (o.value !== undefined) w.value = o.value;
      if (o.description !== undefined) w.description = o.description;
      if (o.enablesPrompts !== undefined) w.prompts = o.enablesPrompts;
      return w;
    });
  }
  return out;
}

const rolecallPreset: PresetAdapter = {
  id: FORMAT_ID,
  label: "RoleCall preset export (ST grammar + macros/choice groups/readme)",
  escrowFormatIds: ["rolecall"],
  outputExtensions: ["json"],
  kind: "preset",

  // 0.95: outranks the generic ST preset codec exactly like rolecall outranks sillytavern on cards.
  detect(input: AdapterInput): number {
    return isRolecallPresetExport(readJsonObject(input)) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const raw = readJsonObject(input);
    if (!raw || !isRolecallPresetExport(raw)) {
      throw new Error("rolecall-preset: not a RoleCall preset export (no RC fingerprint keys)");
    }
    const parsed = parseStPreset(raw);
    // RC exports carry the DISPLAY name on the wire; the filename is only the fallback
    const name = optStr(raw.name) ?? setNameFromFilename(input, "Imported preset");
    const body: PresetBody = parsedToBody(name, parsed);
    const readme = optStr(raw.readme);
    if (readme !== undefined) body.description = readme;
    const groups = Array.isArray(raw.choice_groups) ? raw.choice_groups.filter(isRecord) : [];
    if (groups.length > 0) body.choices = groups.map(choiceFromWire);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(name),
      body,
      original: {
        rolecall: {
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
    const escrow = entity.original?.rolecall;
    const twin = isRecord(escrow?.raw) ? (escrow.raw as Rec) : undefined;
    const out = buildStPreset(entity.body, twin, toDividerDialect(escrow?.unmapped?.["dialect"]));
    // twin-diff on the RC-native keys: rewrite only what drifted, so an unedited import
    // re-emits its choice_groups / name / readme byte-identically off the clone
    const twinName = twin ? optStr(twin.name) : undefined;
    if (entity.body.name !== twinName) out.name = entity.body.name;
    const twinReadme = twin ? optStr(twin.readme) : undefined;
    if ((entity.body.description ?? undefined) !== twinReadme && entity.body.description !== undefined) {
      out.readme = entity.body.description;
    }
    const twinChoices = (Array.isArray(twin?.choice_groups) ? twin.choice_groups.filter(isRecord) : []).map(choiceFromWire);
    const liveChoices = entity.body.choices ?? [];
    if (!deepEq(liveChoices, twinChoices)) out.choice_groups = liveChoices.map(choiceToWire);
    // An empty choice group array is RoleCall's neutral fingerprint. Without a source twin, emit it
    // so the file remains distinguishable from a generic SillyTavern preset and self-readable.
    if (!twin && !Array.isArray(out.choice_groups)) out.choice_groups = [];
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },

  extractRegex(entity: CanonicalPreset): CanonicalRegexSet | null {
    return extractRegexFromPreset(entity.original?.rolecall?.raw, entity.body.name);
  },

  /**
   * Attach standalone regex sets to the emitted preset under `extensions.regex_scripts` - the same
   * field extractRegex reads, so what Kit can import it can now also export.
   *
   * Sets are concatenated in the order given: attaching two sets yields one row list, because the
   * wire has one array and RoleCall applies it in order. Nothing is de-duplicated, since two rules
   * with the same name can legitimately differ and silently dropping one would be a lossy write.
   */
  embedRegex(entity: CanonicalPreset, sets: readonly CanonicalRegexSet[]): AdapterOutput {
    const base = rolecallPreset.fromCanonical(entity);
    return embedRegexIntoPreset(base, sets);
  },
};

export default rolecallPreset;
