/**
 * The seam a scene Prop plugs into (T1 infra; TrackHare is the first Prop, added in T2). One row in
 * the Props wing per registered prop, following the settings-section drop-in pattern
 * (src/ui/apps/settings/sections/registry.ts): a browser bundle cannot glob, so registry.ts imports
 * one line per prop. A prop that is switched on for a scene may also draw on the stage itself.
 */
import type { JSX } from "react";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { SubFeature } from "../../../../core/trackers/subfeatures";
import type { AppContext } from "../../../app-contract";
import type { IconName } from "../../../_shared/ic";
import type { PopoutKind } from "../popout/popout-kind";

/** RoleCall's RichTooltip content (StagecraftExtensions.tsx EXTENSION_TOOLTIPS): a description and a few bullets under the prop's name. */
export interface PropTip { description: string; bullets?: readonly string[] }

/** What a prop may reach beyond the scene's own settings: nothing, the person's model, or the internet. */
export type PropReach = "none" | "model" | "egress";

export interface SceneProp {
  /** Matches the rule-21 id format (chat-rules.ts checkProps): 1 to 64 characters of [a-z0-9-]. */
  id: string;
  name: string;
  /** What the prop may reach. Declared by every prop, shown in the Props wing, and held to the prop's own files by prop-reach.test.ts. */
  reach: PropReach;
  /** True when the prop writes library data (a pack, a piece), not just the scene's own settings. */
  writes?: boolean;
  /** The Props wing row text. */
  blurb: string;
  /** The row's second line, small capitals under the name (RoleCall's "tier": "Local ambience"). */
  tier: string;
  /** The line under the list while it is on. */
  note?: string;
  /** From src/ui/_shared/ic.tsx; add icons there if a prop needs one this seam does not already have. */
  icon: IconName;
  /** A CSS color from tokens, e.g. "var(--prop-hare)". */
  tone: string;
  /** The hover card; the wing's Tooltips switch hides it. */
  tip?: PropTip;
  /** RoleCall's gear ("Open <name> panel", onOpenPanel): shown only while the prop is on. Opens its tab or panel. A prop with a `panel` needs none: the wing opens it. */
  gear?(): void;
  /**
   * The prop's own panel, RoleCall's per-module wing (immersion/index.tsx): the gear opens it inside the Props wing, docked through PopoutSlot, and its Pop out button
   * floats it. It is also a pop-out kind, so the host draws it while the prop is on.
   */
  panel?: PopoutKind;
  /**
   * A wing of its own on the right rail while the prop is on (RoleCall's "their wing icons and deeper panels appear only when
   * enabled"): the icon is the prop's, the label its name, and the wing opens `panel`. Needs `panel`; the gear still opens it too.
   */
  rail?: { blurb: string };
  /** Sub-feature switches drawn under the prop's tile while it is on (RoleCall's MODULE_SUB_FEATURES); the tile also shows one dot for each. */
  subs?: readonly SubFeature[];
  /** Where the prop sits in the wing: absent is a row under Built-In Props; "legacy" and "storyboard" are tiles in RoleCall's Legacy Trackers and Storyboards boxes. */
  group?: "legacy" | "storyboard";
  /** Settings drawn under the row while it is on (RoleCall's `ml-5 border-l pl-3` sub-controls). */
  Sub?: (props: { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void }) => JSX.Element | null;
  /** Drawn on the stage while the prop is on. Gets the scene's context. */
  Stage?: (props: { ctx: AppContext; chat: Chat }) => JSX.Element | null;
  /** Panels this prop can float over the scene, each its own kind (popout/popout-kind.ts). Offered only while the prop is on. */
  popouts?: PopoutKind[];
}

/** The lines the Props wing adds under a prop's tip: what it reaches and whether it writes to the library. */
export const reachNotes = (p: Pick<SceneProp, "reach" | "writes">): string[] => [
  ...(p.reach === "model" ? ["Calls your model"] : p.reach === "egress" ? ["Reaches the internet"] : []),
  ...(p.writes ? ["Writes to your library"] : []),
];

/** The registered props to draw on the stage: switched on, with a Stage of their own. Pure, so the
 * stage slot's "only while it is on" rule is provable without mounting scene-page.tsx. */
export function sceneStageProps(list: readonly SceneProp[], on: readonly string[]): (SceneProp & { Stage: NonNullable<SceneProp["Stage"]> })[] {
  return list.filter((p): p is SceneProp & { Stage: NonNullable<SceneProp["Stage"]> } => on.includes(p.id) && p.Stage !== undefined);
}
