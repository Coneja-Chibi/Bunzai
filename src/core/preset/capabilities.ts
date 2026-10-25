/**
 * Preset Write-for profiles: which first-class controls the editor shows under each lens. Full =
 * union of every authoring wire; other profiles hide only what that platform cannot serialize;
 * hiding never deletes body data. Same shape + function names as core/persona and core/regex
 * capabilities. Ownership matrix: platform-fields.ts (survey-grounded).
 *
 * The Lumiverse lens covers what its exported presets carry: category blocks, sampler overrides,
 * in-history depth, triggers. Export is flat ST grammar. The macro dialect is cataloged in
 * ./macros/lumiverse.ts and machine-verified against a committed capture by scripts/macro-oracle.
 *
 * The authoring targets are the engines vaud can really serialize: RoleCall (native), SillyTavern
 * (round-trip), Marinara (sealed round-trip), Lumiverse (ST-grammar round-trip, its own app's
 * export shape).
 */
import { platformOwnsField } from "./platform-fields";
import { fieldVisibilityOf, makeWriteForProfiles, type FieldVisibility } from "../write-for";

export type { FieldVisibility };

export type PresetWriteForProfile =
  | "full"
  | "rolecall"
  | "sillytavern"
  | "marinara"
  | "lumiverse";

/**
 * Editor-facing control keys. Every key gates a first-class PresetBody slot or block feature.
 * Survey-grounded: if a real authoring wire carries it, it lives here.
 */
export type PresetFieldKey =
  | "name"
  | "description"
  | "prompts"
  | "groups"
  | "samplers"
  | "systemPrompts"
  | "templates"
  | "behavior"
  | "apiOptions"
  | "media"
  | "generation"
  | "choices"
  | "markers"
  | "xmlWrap"
  | "forbidOverrides"
  | "injectionTrigger";

/** Platform lens labels (ONE platform per lens, never smushed - the lore/regex/persona precedent). */
export const PRESET_WRITE_FOR_LABELS: Record<PresetWriteForProfile, string> = {
  full: "Bunraku",
  rolecall: "RoleCall",
  sillytavern: "SillyTavern",
  marinara: "Marinara",
  lumiverse: "Lumiverse",
};

const scaffold = makeWriteForProfiles(PRESET_WRITE_FOR_LABELS);

export const PRESET_WRITE_FOR_PROFILES: readonly PresetWriteForProfile[] = scaffold.profiles;

/** Tolerant pref reader: anything unknown falls back to full (never throws). */
export const parseWriteFor: (v: unknown) => PresetWriteForProfile = scaffold.parse;

/** Show/hide for one control under one lens (delegates to the ownership matrix). */
export function fieldVisibility(
  profile: PresetWriteForProfile,
  key: PresetFieldKey,
): FieldVisibility {
  return fieldVisibilityOf(platformOwnsField(profile, key));
}
