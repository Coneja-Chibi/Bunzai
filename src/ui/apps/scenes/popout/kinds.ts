/**
 * The wings' pop-out kinds: one line per kind, like props/registry.ts (a browser bundle cannot glob). A Prop does not appear here; it
 * lists its own in `SceneProp.popouts`, and popoutKindsFor (popout-core.ts) adds them while the prop is on.
 */
import { activityPopout } from "../compendium/activity-popout";
import type { PopoutKind } from "./popout-kind";

export const WING_POPOUTS: readonly PopoutKind[] = [activityPopout];

/**
 * The wing bodies (Cast, Lorebooks, Booth, Prompting, Final Cut, Context) are kinds too, but the Messenger shell floats them: their body is the shell's own holder node, so the shell hosts
 * their PopoutHost (messenger-chrome.tsx) and they stay out of WING_POPOUTS, which the page's host draws without a shell.
 */
export { popoutIdOf, popoutKindOfProgram, wingBodyPopouts, WING_BODY_SPECS } from "./wing-popouts";
