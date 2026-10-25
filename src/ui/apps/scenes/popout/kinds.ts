/**
 * The wings' pop-out kinds: one line per kind, like props/registry.ts (a browser bundle cannot glob). A Prop does not appear here; it
 * lists its own in `SceneProp.popouts`, and popoutKindsFor (popout-core.ts) adds them while the prop is on.
 */
import { activityPopout } from "../compendium/activity-popout";
import type { PopoutKind } from "./popout-kind";

export const WING_POPOUTS: readonly PopoutKind[] = [activityPopout];
