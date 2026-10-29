/**
 * The Cast wing's pure rules: the tabs, how a failed save reads, the content-rating words RoleCall
 * shows over Bunzai's canonical grades, and the one-line stats and version captions. No React and
 * no IO, so each is proved by plain tests (cast-core.test.ts).
 */
import { ApiHttpError } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";

export type CastTab = "character" | "persona" | "participants";

/** RoleCall's tab strip (LeftWingPanelContent.tsx), in its order. */
export const CAST_TABS: readonly { id: CastTab; label: string; meta?: string }[] = [
  { id: "character", label: "Character" },
  { id: "persona", label: "Persona" },
  { id: "participants", label: "Participants", meta: "Registry" },
];

/** RoleCall's three content ratings over the canonical grades (CharacterPanel.tsx: all_hours, late_night, after_dark). */
export const RATING_CHOICES: readonly { value: "all-ages" | "mature" | "explicit"; label: string }[] = [
  { value: "all-ages", label: "All Hours" },
  { value: "mature", label: "Late Night" },
  { value: "explicit", label: "After Dark" },
];

/** RoleCall's four injection positions, in its order. The canonical grades are the same words. */
export const INJECTION_POSITIONS: readonly { value: "world" | "character" | "scene" | "depth"; label: string; hint: string }[] = [
  { value: "world", label: "World", hint: "Global context at the start" },
  { value: "character", label: "Character", hint: "After character description" },
  { value: "scene", label: "Scene", hint: "Within the current scene" },
  { value: "depth", label: "Depth", hint: "At specific message depth" },
];

export type SaveNote =
  | { kind: "saved"; text: string }
  | { kind: "unapplied"; text: string }
  | { kind: "busy"; text: string }
  | { kind: "stale"; text: string }
  | { kind: "failed"; text: string };

/** What a failed save says, in plain words and with nothing hidden: stale, busy (a reply is being written), or other. */
export function noteForFailure(error: unknown, what: "card" | "persona"): SaveNote {
  const message = toErrorMessage(error, `the ${what} could not be saved`);
  if (error instanceof ApiHttpError && error.status === 409) {
    if (/reply is being written/i.test(message)) return { kind: "busy", text: "A reply is being written. You can save when it finishes." };
    return { kind: "stale", text: `Not saved. This ${what} was changed in the Library after you opened it. Nothing was written and this scene is unchanged.` };
  }
  return { kind: "failed", text: message };
}

/** The line under a successful save. */
export function noteForSaved(version: number | undefined, applied: boolean, what: "card" | "persona"): SaveNote {
  const v = version === undefined ? "" : ` as version ${version}`;
  if (applied) return { kind: "saved", text: `Saved. This scene now uses version ${version ?? "?"}. Other scenes show Update available.` };
  return { kind: "unapplied", text: `The ${what} is saved to the Library${v}, but this scene was left on its old copy: a reply started while you were saving. Update it when the reply finishes.` };
}

/** Persona stats as RoleCall words them: the three numbers, thousands grouped. */
export function statLines(stats: { messages: number; scenes: number; streak: number } | null): { key: "messages" | "scenes" | "streak"; value: string }[] {
  const n = (v: number | undefined) => (v === undefined ? "-" : v.toLocaleString("en-US"));
  return [
    { key: "messages", value: n(stats?.messages) },
    { key: "scenes", value: n(stats?.scenes) },
    { key: "streak", value: n(stats?.streak) },
  ];
}

/** "they / them" as RoleCall shows pronouns: each part capitalised. */
export const prettyPronouns = (raw: string): string =>
  raw.split("/").map((p) => p.trim()).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" / ");

/** Personas the Casting Call lists, filtered by the search words (name or tagline). */
export function filterPersonas<T extends { name: string; brief?: string }>(all: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q === "" ? [...all] : all.filter((p) => p.name.toLowerCase().includes(q) || (p.brief ?? "").toLowerCase().includes(q));
}

/** How many columns RoleCall's Casting Call grid uses for this many tiles. */
export const gridColumns = (count: number): 1 | 2 | 3 | 4 => (count <= 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4);
