/**
 * The persona and recast rules both ChatStore backends share (and
 * 26): validating a persona swap, the stamp a user message keeps, and which cast a card revert lands on.
 * Pure helpers; each backend does its own reads and writes around them.
 */
import { StudioConflictError } from "../../studio/atomic-file";
import type { Cast, CastRef, JsonObject, Message } from "../contracts/chat-store";
import { checkCast, checkSnapshot, fail } from "./chat-rules";
import { isWhole } from "./scalar-rules";

/** Said when a recast is refused because a reply is being written on one of the scene's takes (rule 26). */
export const TURN_OPEN = "a reply is being written in this scene, so its cast cannot change until it finishes";
export const turnOpenConflict = (): StudioConflictError => new StudioConflictError(TURN_OPEN);

/** A swap's input, checked against the scene's current cast: the next cast, and the persona's frozen copy. */
export function checkPersonaInput(
  current: Cast,
  input: { persona?: unknown; snapshot?: unknown; expectedSnapshotVersion?: unknown } | undefined,
): { cast: Cast; persona: JsonObject | undefined; expected: number | undefined } {
  const ref = input?.persona ?? undefined;
  const cast = checkCast({ character: current.character, ...(ref === undefined ? {} : { persona: ref }) });
  const frozen = input?.snapshot ?? undefined;
  // checkSnapshot also proves the persona and its copy come together or not at all.
  const persona = checkSnapshot({ character: {}, ...(frozen === undefined ? {} : { persona: frozen }) }, cast).persona;
  const expected = input?.expectedSnapshotVersion;
  if (expected !== undefined && !isWhole(expected, 0)) fail("expectedSnapshotVersion must be a whole number");
  return { cast, persona, expected };
}

/** A swap that expected another snapshot than the scene holds is a conflict (rule 13). */
export function requireSnapshotVersion(actual: number, expected: number | undefined): void {
  if (expected !== undefined && expected !== actual) throw new StudioConflictError("the scene is on snapshot " + actual + ", not " + expected);
}

/** `setCast` moves the card; whoever is played changes only through `setPersona`, which keeps the persona counters and the way back right (rule 13). */
export function refusePersonaChange(current: Cast, next: Cast): void {
  if (current.persona?.id !== next.persona?.id) fail("a card update cannot change the persona: use setPersona");
}

/** A variant id (rule 27): text, or null for the base card. The store never reads the card, so it cannot know the id exists. */
export function checkVariantId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value === "" || value.length > 200) fail("variantId must be a non-empty id of at most 200 characters, or null");
  return value;
}

/** The stamp a user message gets from the scene's cast: none while the persona has no name, null for no persona. */
export function personaStamp(cast: Cast): Message["persona"] {
  if (!cast.persona) return null;
  return cast.persona.name ? { id: cast.persona.id, name: cast.persona.name } : undefined;
}

const sameRef = (a: CastRef | undefined, b: CastRef | undefined): boolean => a?.id === b?.id && a?.version === b?.version;

/** Whether a card revert would also move the persona (the way back was saved under a different one). */
export const revertMovesPersona = (cast: Cast, previous: Cast): boolean => !sameRef(cast.persona, previous.persona);

/** Where a card revert lands: the previous card, with whoever is being played now (rule 13). */
export const revertedCast = (cast: Cast, previous: Cast): Cast => ({ character: previous.character, ...(cast.persona ? { persona: cast.persona } : {}) });
