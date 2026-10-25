/**
 * What the person's Lock, Forbid, Reorganize and Move choices do to the saved list (ChatCompendiumBook.tree, rule 38), as pure
 * edits: each returns the next list, or null when nothing is left to keep (the patch then clears the whole choice). One place for the
 * menu, the Settings list and the drag, so they cannot disagree. A list is replaced whole by the patch, so each edit starts from
 * what the scene holds now.
 */
import type { ChatCompendiumTreeConstraints } from "../../stage/contracts/chat-settings-types";

export type ConstraintKind = "locked" | "forbidden" | "reorganize";
export const CONSTRAINT_KINDS: readonly ConstraintKind[] = ["locked", "forbidden", "reorganize"];

const compact = (c: ChatCompendiumTreeConstraints): ChatCompendiumTreeConstraints | null => {
  const out: ChatCompendiumTreeConstraints = {};
  for (const k of CONSTRAINT_KINDS) if ((c[k] ?? []).length > 0) out[k] = c[k]!;
  if (Object.keys(c.pins ?? {}).length > 0) out.pins = c.pins!;
  return Object.keys(out).length > 0 ? out : null;
};

/** The flag on or off for a branch or an entry. */
export function setConstraint(c: ChatCompendiumTreeConstraints | undefined, kind: ConstraintKind, id: string, on: boolean): ChatCompendiumTreeConstraints | null {
  const rest = (c?.[kind] ?? []).filter((x) => x !== id);
  return compact({ ...c, [kind]: on ? [...rest, id] : rest });
}

/** File `entryId` under `targetId` (an entry); a pin to itself is no pin. */
export function setPin(c: ChatCompendiumTreeConstraints | undefined, entryId: string, targetId: string): ChatCompendiumTreeConstraints | null {
  return compact({ ...c, pins: { ...c?.pins, ...(entryId === targetId ? {} : { [entryId]: targetId }) } });
}

/** Every flag and pin on one branch or entry removed (the X in Settings). */
export function clearConstraints(c: ChatCompendiumTreeConstraints | undefined, id: string): ChatCompendiumTreeConstraints | null {
  const pins = Object.fromEntries(Object.entries(c?.pins ?? {}).filter(([entry]) => entry !== id));
  return compact({ locked: (c?.locked ?? []).filter((x) => x !== id), forbidden: (c?.forbidden ?? []).filter((x) => x !== id), reorganize: (c?.reorganize ?? []).filter((x) => x !== id), pins });
}

export interface Flags { locked: boolean; forbidden: boolean; reorganize: boolean; pinned: boolean }

export const flagsOf = (c: ChatCompendiumTreeConstraints | undefined, id: string): Flags => ({
  locked: (c?.locked ?? []).includes(id), forbidden: (c?.forbidden ?? []).includes(id), reorganize: (c?.reorganize ?? []).includes(id), pinned: c?.pins?.[id] !== undefined,
});

/** Every id the person has flagged or pinned, in a stable order: what the Settings list shows. */
export function constrainedIds(c: ChatCompendiumTreeConstraints | undefined): string[] {
  return [...new Set([...(c?.locked ?? []), ...(c?.forbidden ?? []), ...(c?.reorganize ?? []), ...Object.keys(c?.pins ?? {})])];
}
