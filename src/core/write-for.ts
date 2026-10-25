/**
 * The Write-for profile scaffolding every per-entity capabilities module builds on (lore, regex,
 * persona, and any future lens): the profile list, its tab labels, and a tolerant parser that falls
 * back to "full" rather than throw. Three copies of this exact shape already admitted in their own
 * docblocks that they were cloned from one another (lore -> regex -> persona). The per-entity field
 * keys and visibility computation stay local - that part genuinely differs per entity (lore alone
 * has an emphasize/demote tier the others do not), so only the scaffolding moves here.
 */

/** Build the profile list, a type guard, and a tolerant parser from a lens's own labels map. The
 *  profile order is the labels object's own key order, so callers keep authoring one ordered object
 *  instead of a label map plus a separately-ordered array that can drift out of sync with it. */
export function makeWriteForProfiles<P extends string>(labels: Readonly<Record<P, string>>) {
  const profiles = Object.keys(labels) as unknown as readonly P[];
  const isProfile = (v: unknown): v is P => typeof v === "string" && (profiles as readonly string[]).includes(v);
  const parse = (v: unknown): P => (isProfile(v) ? v : ("full" as P));
  return { profiles, isProfile, parse };
}

export type FieldVisibility = "show" | "hide";

/** "show" exactly when the platform owns the field, "hide" otherwise - the binary visibility rule
 *  persona and preset capabilities both delegate to their own ownership matrix for. (Lore's extra
 *  emphasize/demote tier and regex's whole-profile visibility map are genuinely richer than this one
 *  ternary, so they stay local instead of forcing this shape on them.) */
export const fieldVisibilityOf = (owns: boolean): FieldVisibility => (owns ? "show" : "hide");

/**
 * The ownership predicate every per-entity platform-fields module exports as `platformOwnsField`:
 * a field is exposed when it is core, when the profile is the full union, or when that profile's wire
 * lists it as an extra. An unknown profile owns only the core keys (the extras lookup is tolerant).
 */
export function makePlatformOwns<P extends string, K extends string>(
  coreKeys: readonly K[],
  extras: Readonly<Record<P, readonly K[]>>,
): (profile: P, key: K) => boolean {
  return (profile, key) => {
    if (coreKeys.includes(key)) return true;
    if (profile === "full") return true;
    return (extras[profile] ?? []).includes(key);
  };
}
