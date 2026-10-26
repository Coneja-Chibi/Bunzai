/**
 * A tracker module as a registered Prop: id `tracker-<module>` (the id the assembler reads, core/assembly/trackers.ts), a tile in RoleCall's
 * Legacy Trackers or Storyboards box, and its panel as a pop-out kind. One line per module here and one in props/registry.ts.
 */
import type { JSX } from "react";
import { TRACKER_PROP_PREFIX, type TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { IconName } from "../../../../_shared/ic";
import { SUBFEATURES } from "../../../../../core/trackers/subfeatures";
import type { PopoutContext } from "../../popout/popout-kind";
import type { PropReach, SceneProp } from "../prop-contract";
import { registerSummary, type SummaryLine } from "./summary";

export interface TrackerPropDef {
  module: TrackerModule;
  name: string;
  /** RoleCall's card description (builtin-catalog.ts LEGACY_TRACKER_MODULES, STORYBOARD_MODULES). */
  blurb: string;
  icon: IconName;
  tone: string;
  group: "legacy" | "storyboard";
  /** Whether the panel asks the person's model for items (its Generate and Refresh buttons). */
  reach: PropReach;
  /** The panel's header when floating, and the line "<noun> is floating" in its docked spot. */
  title: string;
  noun: string;
  width?: number;
  Panel: (c: PopoutContext) => JSX.Element;
  /** The module's one-line card summary (its `summary.ts`). */
  summary: SummaryLine;
}

const LEGACY_BULLETS = [
  "Legacy mechanical tracker for optional game-like state.",
  "Only updates automatically when Story Director is on and automatic updates are on for it.",
  "Use these for mechanics not yet covered by Storyboards.",
] as const;

export function trackerProp(def: TrackerPropDef): SceneProp {
  const id = `${TRACKER_PROP_PREFIX}${def.module}`;
  registerSummary(def.module, def.summary);
  return {
    id,
    name: def.name,
    reach: def.reach,
    blurb: def.blurb,
    tier: def.group === "legacy" ? "Legacy tracker" : "Storyboard",
    icon: def.icon,
    tone: def.tone,
    group: def.group,
    ...(SUBFEATURES[def.module] ? { subs: SUBFEATURES[def.module]! } : {}),
    tip: { description: def.blurb, bullets: def.group === "legacy" ? LEGACY_BULLETS : [] },
    panel: { id: `tracker.${def.module}`, title: def.title, noun: def.noun, icon: def.icon, width: def.width ?? 420, top: 120, render: (c) => <def.Panel {...c} /> },
  };
}
