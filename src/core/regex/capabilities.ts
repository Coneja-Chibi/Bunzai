/**
 * Regex Write-for profiles: which first-class fields the editor shows.
 * Full = union of every platform wire. Other profiles hide only fields that platform cannot
 * serialize. Hiding never deletes body data. Cloned from core/lore/capabilities.ts (same shape,
 * same function names).
 *
 * Ownership matrix: platform-fields.ts (survey-grounded, design/REGEX-FORMATS.md).
 */
import { platformOwnsField } from "./platform-fields";
import { fieldVisibilityOf, makeWriteForProfiles, type FieldVisibility } from "../write-for";

export type { FieldVisibility };

export type RegexWriteForProfile =
  | "full"
  | "sillytavern"
  | "risu"
  | "rolecall"
  | "lumiverse"
  | "marinara";

/**
 * Editor-facing keys. Every key maps to a first-class RegexRule slot. Survey-grounded: if a real
 * format serializes it, it lives here (design/REGEX-FORMATS.md field tables).
 */
export type RegexFieldKey =
  | "label"
  | "note"
  | "find"
  | "flags"
  | "useFlags"
  | "replace"
  | "trimStrings"
  | "phases"
  | "targets"
  | "substituteFind"
  | "minDepth"
  | "maxDepth"
  | "runOnEdit"
  | "characterIds"
  | "enabled"
  | "sortOrder";

/** Platform tab labels (character/lore lens precedent: ONE platform per lens, never smushed). */
export const REGEX_WRITE_FOR_LABELS: Record<RegexWriteForProfile, string> = {
  full: "Bunzai",
  sillytavern: "SillyTavern",
  risu: "Risu",
  rolecall: "RoleCall",
  lumiverse: "Lumiverse",
  marinara: "Marinara",
};

const scaffold = makeWriteForProfiles(REGEX_WRITE_FOR_LABELS);

export const REGEX_WRITE_FOR_PROFILES: readonly RegexWriteForProfile[] = scaffold.profiles;

export const isRegexWriteForProfile: (v: unknown) => v is RegexWriteForProfile = scaffold.isProfile;

export const parseWriteFor: (v: unknown) => RegexWriteForProfile = scaffold.parse;

/** Visibility for a Write-for profile: show every key that platform owns, hide the rest. */
export function regexFieldVisibility(
  profile: RegexWriteForProfile,
): Record<RegexFieldKey, FieldVisibility> {
  const keys: RegexFieldKey[] = [
    "label",
    "note",
    "find",
    "flags",
    "useFlags",
    "replace",
    "trimStrings",
    "phases",
    "targets",
    "substituteFind",
    "minDepth",
    "maxDepth",
    "runOnEdit",
    "characterIds",
    "enabled",
    "sortOrder",
  ];
  const out = {} as Record<RegexFieldKey, FieldVisibility>;
  for (const key of keys) {
    out[key] = fieldVisibilityOf(platformOwnsField(profile, key));
  }
  return out;
}

export function fieldVisible(profile: RegexWriteForProfile, key: RegexFieldKey): boolean {
  return regexFieldVisibility(profile)[key] !== "hide";
}
