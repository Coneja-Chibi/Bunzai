/**
 * The scene's wings as RoleCall's rails list them (the scene page's LEFT_WING_ITEMS and RIGHT_WING_ITEMS, `controlTooltips.ts` WING_PANEL_TASK_LABELS and WING_PANEL_TOOLTIPS): the order, the
 * tone each wing carries, the task line on its rail label, the long help under a long hover, and the width it opens at (`getLeftPanelWidth` / `getRightPanelWidth`, rail padding inside the width).
 */
import type { IconName } from "../../_shared/ic";
import type { SceneProp } from "./props/prop-contract";

export interface Wing {
  id: string;
  side: "l" | "r";
  label: string;
  /** The task line (RoleCall's task label): the rail label's second line and the button's title. */
  blurb: string;
  /** The long help, shown beside the label after a half second's hover. */
  detail: string;
  icon: IconName;
  tone: string;
  /** The width the wing opens at, until the viewer drags it. */
  width: number;
}

export const WINGS: readonly Wing[] = [
  { id: "booth", side: "l", label: "Control Booth", blurb: "Scene setup and automation", detail: "Live scene controls for models, lorebooks, Story Director, images, post-production, and scene automation.", icon: "lucide:zap", tone: "var(--rc-wing-booth)", width: 550 },
  { id: "cast", side: "l", label: "Cast", blurb: "Character, persona, and speakers", detail: "Open character and persona tools.", icon: "lucide:drama", tone: "var(--rc-wing-cast)", width: 1000 },
  { id: "world", side: "l", label: "World", blurb: "Lorebooks and Compendium", detail: "Open lorebook and compendium tools.", icon: "lucide:compass", tone: "var(--rc-wing-world)", width: 1258 },
  { id: "prompting", side: "l", label: "Prompting", blurb: "Preset, guides, scene note, writing tools", detail: "Open the active preset, guides, scene note, and writing tools.", icon: "lucide:wand-sparkles", tone: "var(--rc-wing-prompting)", width: 1000 },
  { id: "finalcut", side: "l", label: "Final Cut", blurb: "Rewrites and text cleanup", detail: "Open the Final Cut panel.", icon: "lucide:scissors", tone: "var(--rc-wing-finalcut)", width: 1120 },
  { id: "props", side: "l", label: "Props", blurb: "Tools and scene mechanics", detail: "Open props, generated post actions, and active stage tools.", icon: "lucide:puzzle", tone: "var(--rc-wing-props)", width: 1120 },
  { id: "ai", side: "r", label: "AI", blurb: "Model and generation settings", detail: "Open model and generation controls.", icon: "lucide:cpu", tone: "var(--rc-wing-ai)", width: 720 },
  { id: "stage", side: "r", label: "Stage", blurb: "Appearance, gallery, and music", detail: "Open appearance, gallery, and music controls.", icon: "lucide:monitor", tone: "var(--rc-wing-stage)", width: 800 },
  { id: "context", side: "r", label: "Context", blurb: "What the AI sees and remembers", detail: "Open Prompt Inspector, active lore, and summary controls.", icon: "lucide:brain-circuit", tone: "var(--rc-wing-context)", width: 880 },
];

/** The tab a wing opens on: the one a Messenger program names (messenger/programs.ts), else the wing's own first. */
export const tabOr = <T extends string>(tabs: readonly T[], tab: string | undefined, first: T): T => tabs.find((t) => t === tab) ?? first;

export const propWingId = (id: string): string => `prop:${id}`;

/** Derived from the registered Props, with no separately maintained wing catalog. */
export function propWings(list: readonly SceneProp[], on: readonly string[] | null): Wing[] {
  return list.flatMap((p) => p.rail && p.panel && on?.includes(p.id) ? [{ id: propWingId(p.id), side: "r" as const, label: p.name, blurb: p.rail.blurb, detail: p.rail.blurb, icon: p.icon, tone: p.tone, width: p.panel.width ?? 500 }] : []);
}

export const wingOf = (id: string | null, extra?: readonly Wing[]): Wing | undefined => (id === CORE_WING.id ? CORE_WING : WINGS.find((w) => w.id === id)) ?? extra?.find((w) => w.id === id);

/** The linked external engine settings wing. */
export const CORE_WING: Wing = { id: "core", side: "r", label: "rp-core", blurb: "Director and memory in rp-core", detail: "Configure the linked rp-core session.", icon: "lucide:cpu", tone: "var(--stage-warn)", width: 720 };
