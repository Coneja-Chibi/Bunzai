/**
 * The Correction Tools, the pure half (RoleCall's CorrectionToolsPanel.tsx): the three tabs and their copy, which
 * library guides the Corrections tab lists, and what each tool's preview holds before Apply. The copy is
 * RoleCall's word for word.
 */
import type { GuideRecord } from "../../../core/guide-record";
import { replaceRange, REWRITE_ACTIONS, type RewriteAction, type TextRange } from "../../../core/draft-prompts";
import { TOOL_LABELS } from "../../../core/final-cut/pass";

export type CorrectTab = "spellcheck" | "corrections" | "rewrite";

export const CORRECT_TABS: readonly { key: CorrectTab; label: string; blurb: string }[] = [
  { key: "spellcheck", label: "Spellcheck", blurb: "Automatically polish grammar, spelling, and readability while maintaining the character's voice." },
  { key: "corrections", label: "Corrections", blurb: "Apply correction guides to fix specific issues or improve the message according to custom guidelines." },
  { key: "rewrite", label: "Rewrite", blurb: "Highlight a passage in the message, then delete it or ask the model to rewrite, expand, or reduce only that selection." },
];

/** The Rewrite tab's buttons, in RoleCall's order. Delete is local and calls no model. */
export const REWRITE_BUTTONS: readonly { action: "delete" | RewriteAction; label: string }[] = [
  { action: "delete", label: "Delete" },
  ...REWRITE_ACTIONS.map((action) => ({ action, label: TOOL_LABELS[action] })),
];

/** What the Corrections tab lists: library guides typed "correction". A hidden guide is hidden everywhere, so it is not offered. */
export const correctionGuides = (guides: readonly GuideRecord[]): GuideRecord[] => guides.filter((g) => g.type === "correction" && g.visible);

/** A tool's result, held until the person applies it. `selected` and `replacement` are set for a Rewrite. */
export interface Preview {
  kind: CorrectTab;
  original: string;
  corrected: string;
  selected?: string;
  replacement?: string;
}

/** A Rewrite's preview: the whole message with the selection replaced (an empty replacement is Delete). */
export function selectionPreview(message: string, range: TextRange, replacement: string): Preview {
  return { kind: "rewrite", original: message, corrected: replaceRange(message, range, replacement), selected: range.text, replacement };
}

/** The text Apply writes. Spellcheck and Corrections are trimmed, as RoleCall's handlers trim them; a Rewrite keeps its spacing. */
export const applied = (preview: Preview): string => (preview.kind === "rewrite" ? preview.corrected : preview.corrected.trim());
