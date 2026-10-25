/** TrackHare, the ported SillyTavern extension, as a registered scene Prop (design/wireframes/props/
 * trackhare.html, "props" state). Registered in props/registry.ts. */
import type { SceneProp } from "../prop-contract";
import { hareTracePopout } from "./hare-popout";
import { HareStage } from "./hare-stage";

export const trackHareProp: SceneProp = {
  id: "trackhare",
  reach: "none",
  name: "TrackHare",
  tier: "Lore tracer",
  blurb: "See which lorebook entries went into each reply and why, which ones did not and why not, how the prompt's tokens were spent, and which entries woke which.",
  note: "TrackHare only watches; it never changes what is sent. Its button appears on the stage while it is on.",
  tone: "var(--prop-hare)",
  icon: "lucide:puzzle",
  Stage: HareStage,
  popouts: [hareTracePopout],
};
