/**
 * Persona Write-for profiles: which first-class fields the editor shows. Full = union of every
 * platform wire; other profiles hide only fields that platform cannot serialize; hiding never
 * deletes body data. Cloned from core/regex/capabilities.ts (same shape, same function names). Ownership matrix: platform-fields.ts (survey-grounded,
 * design/PERSONA-LANDSCAPE.md).
 */
import { platformOwnsField } from "./platform-fields";
import { fieldVisibilityOf, makeWriteForProfiles, type FieldVisibility } from "../write-for";

export type { FieldVisibility };

export type PersonaWriteForProfile =
  | "full"
  | "rolecall"
  | "sillytavern"
  | "lumiverse"
  | "marinara"
  | "agnai";

/**
 * Editor-facing keys. Every key maps to a first-class PersonaBody slot (or a nested slot named
 * by its obvious owner). Survey-grounded: if a real wire serializes it, it lives here.
 */
export type PersonaFieldKey =
  | "name"
  | "brief"
  | "content"
  | "sections"
  | "sectionOrder"
  | "traits"
  | "tagline"
  | "age"
  | "height"
  | "pronouns"
  | "pronounSet"
  | "signatureColor"
  | "colors"
  | "imageUrl"
  | "knowledgeRefs"
  | "rating"
  | "injection"
  | "wrapper";

/** Platform tab labels (ONE platform per lens, never smushed - the lore/regex precedent). */
export const PERSONA_WRITE_FOR_LABELS: Record<PersonaWriteForProfile, string> = {
  full: "Bunzai",
  rolecall: "RoleCall",
  sillytavern: "SillyTavern",
  lumiverse: "Lumiverse",
  marinara: "Marinara",
  agnai: "Agnai",
};

const scaffold = makeWriteForProfiles(PERSONA_WRITE_FOR_LABELS);

export const PERSONA_WRITE_FOR_PROFILES: readonly PersonaWriteForProfile[] = scaffold.profiles;

/** Tolerant pref reader: anything unknown falls back to full (never throws). */
export const parseWriteFor: (v: unknown) => PersonaWriteForProfile = scaffold.parse;

/** Show/hide for one field under one lens (delegates to the ownership matrix). */
export function fieldVisibility(
  profile: PersonaWriteForProfile,
  key: PersonaFieldKey,
): FieldVisibility {
  return fieldVisibilityOf(platformOwnsField(profile, key));
}
