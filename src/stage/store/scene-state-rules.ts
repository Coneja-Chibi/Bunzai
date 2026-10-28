/**
 * What both ChatStores share about scene state (docs/reference/scene-state.md): the check every delta passes before it
 * is kept, and the rebuild bound to the declared slots. Shared so the memory and SQLite stores cannot drift.
 */
import { dropUnchanged, fold } from "../../core/scene-state/fold";
import { rebuild, type RebuildInput } from "../../core/scene-state/rebuild";
import { deltaBytes } from "../../core/scene-state/size";
import type { Delta, SceneState } from "../../core/scene-state/types";
import { SANITY_TEXT } from "../../entities/_shared/sanity";
import { slotOf } from "../../generated/slots";
import type { JsonValue } from "../contracts/chat-store";
import { checkNumber, fail, isJson, onlyKeys } from "./scalar-rules";

/** A list of deltas, each for a declared slot with a path its strategy reads and a JSON value. There is no size cap: a turn's writes are bounded by their sources (the model's output, the macro engine's output cap). Returns a private copy. */
export function checkDeltas(value: unknown): Delta[] {
  if (!Array.isArray(value)) fail("deltas must be a list");
  const out = value.map((raw): Delta => {
    const d = onlyKeys(raw, ["slot", "path", "value", "removed", "at"], "delta");
    if (typeof d.slot !== "string") fail("delta slot must be text");
    const slot = d.slot;
    const def = slotOf(slot);
    if (!def) fail(`unknown slot: ${slot}`);
    if (!Array.isArray(d.path) || d.path.length !== (def.diff === "value" ? 0 : 1)) fail(`a delta for ${slot} needs a path of ${def.diff === "value" ? "no names" : "one name"}`);
    const path = d.path.map((p: unknown) => (typeof p === "string" && p !== "" ? p : fail("a delta path name must be non-empty text")));
    const at = checkNumber(d.at, "delta at must be a finite number", 0, Number.MAX_SAFE_INTEGER);
    if (d.removed !== undefined) {
      if (d.removed !== true || d.value !== undefined) fail("a removal carries removed: true and no value");
      return { slot, path, removed: true, at };
    }
    if (d.value === undefined || !isJson(d.value)) fail("a delta value must be JSON");
    return { slot, path, value: structuredClone(d.value) as JsonValue, at };
  });
  return out;
}

/**
 * Deltas that can come from an import or a person's edit (a take's base, a message's own): checked like any, and one write past a hostile-input
 * ceiling (its serialized bytes) refused as unusually large. The ceiling is for one hostile input, so it counts only the incoming write, not what the
 * message already carries. A guard against a hostile file, not a design limit.
 */
export function checkImportedDeltas(value: unknown): Delta[] {
  const out = checkDeltas(value);
  if (deltaBytes(out) > SANITY_TEXT) fail("these state changes are unusually large");
  return out;
}

/** What of `added` changes `base` (the state a message builds from), so a write of a value already there adds nothing. */
export const changed = (base: SceneState, added: readonly Delta[]): Delta[] => dropUnchanged(base, added, slotOf);

/** A take's base: the state these deltas fold to over nothing. */
export const baseState = (deltas: readonly Delta[]): SceneState => fold({}, deltas, slotOf);

/** The state after a path of shown versions: `rebuild` over the declared slots. */
export const rebuildState = (input: Omit<RebuildInput, "slotOf">): { state: SceneState; fresh: [string, SceneState][] } => rebuild({ ...input, slotOf });
