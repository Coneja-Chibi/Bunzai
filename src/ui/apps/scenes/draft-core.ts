/**
 * The composer's draft tools, the pure half (RoleCall's Expand as character and Polish Input, StandardLayout.tsx
 * 2328-2381 and ChatInputTransparentDock.tsx 1022-1056, 2429-2486): what the status strip above the composer says in
 * each phase, and what a polish pass did to the text. The words are RoleCall's, without its glyphs.
 */
import type { Perspective } from "../../../core/draft-prompts";

/** One of the pill's three segments: its label and RoleCall's tooltip. */
export const PERSPECTIVE_PILL: readonly { key: Perspective; label: string; title: string }[] = [
  { key: "1st", label: "1ST", title: "1st person: I / we" },
  { key: "2nd", label: "2ND", title: "2nd person: you" },
  { key: "3rd", label: "3RD", title: "3rd person: name / they" },
];

export type DraftStatus =
  | { tag: "idle" }
  /** Expand mode (the message menu's entry): type an outline, then pick a perspective. */
  | { tag: "expand" }
  | { tag: "working"; kind: "impersonate" | "polish" }
  /** The expanded message sits in the composer for the person to edit. */
  | { tag: "landed" }
  /** A polish pass changed the text; the original is kept for Revert. */
  | { tag: "compare"; before: string; after: string }
  | { tag: "note"; text: string }
  | { tag: "error"; text: string };

export const IDLE: DraftStatus = { tag: "idle" };

/** The ribbon's eyebrow and helper line for a phase, or null when the strip shows no ribbon. */
export function ribbonCopy(status: DraftStatus, persona: string): { eyebrow: string; helper: string } | null {
  if (status.tag === "expand") return { eyebrow: "Expand as character", helper: "Type an outline, then pick a perspective to expand." };
  if (status.tag === "working") {
    return status.kind === "impersonate"
      ? { eyebrow: `Writing as ${persona}`, helper: "Drafting your message, landing in the input shortly." }
      : { eyebrow: "Polishing your draft", helper: "Spell + grammar pass, landing in the input shortly." };
  }
  if (status.tag === "landed") return { eyebrow: `Writing as ${persona}`, helper: "Edit and send when ready. Cancel to clear it." };
  return null;
}

/** After Polish Input: the text unchanged says so and keeps the composer as it is; a changed text keeps the original for Revert. */
export function polishOutcome(before: string, after: string): DraftStatus {
  return after.trim() === before.trim() ? { tag: "note", text: "Nothing to fix." } : { tag: "compare", before, after };
}
