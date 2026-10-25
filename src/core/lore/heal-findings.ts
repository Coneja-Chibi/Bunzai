/**
 * Turn import heal notes into Health findings (worth-a-look, book-level).
 */
import type { LoreFinding } from "./inspect";
import type { HealNote } from "./heal";
import { isRecord } from "../guards";

export function findingsFromHealNotes(notes: readonly HealNote[]): LoreFinding[] {
  return notes.map((n) => ({
    rule: "legacy-leftovers" as const,
    severity: "worth-a-look" as const,
    message: n.path ? `Import heal (${n.path}): ${n.message}` : `Import heal: ${n.message}`,
  }));
}

/** Read heal notes from entity original bag (vaud-studio unmapped). */
export function healNotesFromOriginal(original: unknown): HealNote[] {
  if (!isRecord(original)) return [];
  const o = original;
  const studio = o["vaud-studio"];
  if (!isRecord(studio)) return [];
  const unmapped = studio.unmapped;
  if (!isRecord(unmapped)) return [];
  const raw = unmapped.healNotes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((n) => ({
      path: typeof n.path === "string" ? n.path : "",
      message: typeof n.message === "string" ? n.message : "healed field",
    }))
    .filter((n) => n.message.length > 0);
}
