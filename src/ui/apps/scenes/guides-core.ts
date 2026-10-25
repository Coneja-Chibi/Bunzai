/**
 * The Prompting wing's Guides and Scene Note rules, pure (RoleCall's GuideListRail, GuidesPanel and
 * AuthorNotePanel at the): the list grouped by category with empty groups hidden, the search
 * by title, the active count, the mode pills, and the note's helper lines.
 */
import { GUIDE_CATEGORIES, type GuideCategory, type GuideType, type GuideInput, type GuideRecord } from "../../../core/guide-record";
import type { GuideMode } from "../../../core/assembly/guides";
import type { ChatNote } from "../../../stage/contracts/chat-store";
import type { IconName } from "../../_shared/ic";

/** RoleCall's CATEGORY_ICONS (guides-editor/primitives.tsx:30): one glyph per category, on the list head and the editor's head. */
export const CATEGORY_ICON: Readonly<Record<GuideCategory, IconName>> = { situational: "lucide:drama", thinking: "lucide:brain", clothes: "lucide:shirt", state: "lucide:heart-pulse", rules: "lucide:scroll-text", custom: "lucide:star" };

export const CATEGORY_LABEL: Record<GuideCategory, string> = { situational: "Situational", thinking: "Thinking", clothes: "Clothes", state: "State", rules: "Rules", custom: "Custom" };

/** RoleCall's PLACEMENT_MODE_META: the pill on a row, the chip in the editor, and what it does. */
export const MODE_META: Record<GuideMode, { pill: string; label: string; hint: string }> = {
  standard: { pill: "Std", label: "Standard", hint: "Classic slot for the role above." },
  depth: { pill: "Depth", label: "Depth", hint: "Own message near the end of the chat (0 = very bottom)." },
  append: { pill: "Append", label: "Append", hint: "Sticks to the bottom of the latest message, no extra message." },
  macro: { pill: "Macro", label: "Macro", hint: "Welds onto the chosen content wherever it lands, in any preset." },
  chat_start: { pill: "Start", label: "Chat Start", hint: "Runs once when a scene begins, never appears in the context, never re-rolls." },
};

/** RoleCall's guide types (GuideEditorPageClient.tsx GUIDE_TYPES): a "correction" guide is what Correct's Corrections tab lists; injection ignores the type. */
export const TYPE_META: Record<GuideType, string> = {
  guide: "General purpose guided response",
  correction: "Corrects AI output style/tone",
  spellcheck: "Fixes spelling and grammar",
  prefill: "Pre-fills AI response start",
  custom: "Custom injection type",
};

export interface GuideGroup {
  category: GuideCategory;
  rows: GuideRecord[];
}

/** Guides the list shows: not hidden, matching the search in their title, grouped in RoleCall's category order with empty groups left out. */
export function groupGuides(guides: readonly GuideRecord[], query: string): GuideGroup[] {
  const q = query.trim().toLowerCase();
  const shown = guides.filter((g) => g.visible && (!q || g.title.toLowerCase().includes(q)));
  return GUIDE_CATEGORIES.map((category) => ({ category, rows: shown.filter((g) => g.category === category) })).filter((g) => g.rows.length > 0);
}

/** How many of the scene's switched-on guides are in the library and visible: the "n active" in the tab. */
export const activeCount = (guides: readonly GuideRecord[], on: readonly string[]): number => on.filter((id) => guides.some((g) => g.id === id && g.visible)).length;

/** The scene's switched-on list with one guide switched on (last) or off. */
export const withGuide = (on: readonly string[], id: string, enabled: boolean): string[] => (enabled ? [...on.filter((x) => x !== id), id] : on.filter((x) => x !== id));

/** The editor's starting values for a guide, or RoleCall's New Guide when there is none. */
export const draftOf = (g?: GuideRecord): GuideInput => ({
  title: g?.title ?? "",
  content: g?.content ?? "",
  type: g?.type ?? "guide",
  category: g?.category ?? "situational",
  role: g?.role ?? "user",
  mode: g?.mode ?? "standard",
  depth: g?.depth ?? null,
  target: g?.target ?? null,
  side: g?.side ?? null,
  visible: g?.visible ?? true,
});

/** A mode chosen in the editor: depth and append start at 0, macro at persona and append, the rest clear them (RoleCall's setMode). */
export const withMode = (d: GuideInput, mode: GuideMode): GuideInput => ({
  ...d,
  mode,
  depth: mode === "depth" || mode === "append" ? d.depth ?? 0 : null,
  target: mode === "macro" ? d.target ?? "persona" : null,
  side: mode === "macro" ? d.side ?? "append" : null,
});

export const FREQUENCIES: readonly { value: number; label: string }[] = [
  { value: 1, label: "Every turn" },
  { value: 2, label: "Every 2nd" },
  { value: 3, label: "Every 3rd" },
  { value: 4, label: "Every 4th" },
  { value: 0, label: "Never (disabled)" },
];

/**
 * Where an in-chat note lands. RoleCall's panel says "before the last N chat messages", but its
 * assembly puts the note before the chat message at index total - N - 1, which is the last N + 1
 * (the message being answered counts); this says what the request does.
 */
export const depthHint = (depth: number): string => (depth === 0 ? "Injected right before your latest message" : `Injected before the last ${depth + 1} chat messages`);

export const frequencyHint = (frequency: number): string => (frequency === 0 ? "Scene Note is disabled" : frequency === 1 ? "Included with every message" : `Included every ${frequency} messages`);

export const sameNote = (a: ChatNote, b: ChatNote): boolean => a.text === b.text && a.position === b.position && a.depth === b.depth && a.frequency === b.frequency;
