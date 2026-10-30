/**
 * The Story Director as a registered scene Prop (RoleCall's `story-director` row, builtin-catalog.ts:8 and StagecraftExtensions.tsx:1028-1219): tier "Story engine", the settings block under its
 * row while it is on, its panel (the gear opens it, and so does its own wing on the right rail; it can float), and the floating activity button on the stage. On means the Prop is in the scene's Props; there is no second switch
 * (ChatStore rule 47). It calls the person's model before each reply (reach "model"), and writes only its own saved story. Registered in props/registry.ts.
 */
import type { SceneProp } from "../prop-contract";
import { DirectorFab } from "./director-fab";
import { directorPanelPopout, DIRECTOR_TONE } from "./director-panel";
import { DirectorSettings } from "./director-settings";
import { DIRECTOR_PROP_ID } from "../../../../../core/director/settings";

export const directorProp: SceneProp = {
  id: DIRECTOR_PROP_ID,
  reach: "model",
  name: "Story Director",
  tier: "Story engine",
  blurb: "Turns on the behind-the-scenes story intelligence pass for this chat. It plans the story before each reply is written.",
  note: "The Story Director plans each reply before it is written. Turning it off stops new planning but does not delete what it saved.",
  tone: DIRECTOR_TONE,
  icon: "mdi:drama-masks",
  tip: {
    description: "Turns on the behind-the-scenes story intelligence pass for this chat. It plans the story before each reply is written.",
    bullets: [
      "Adds Story Director model, personality, command mode, temperature, creativity, and retry controls.",
      "Saves per chat; turning it off stops new planning but does not delete existing state.",
    ],
  },
  panel: directorPanelPopout,
  rail: { blurb: "Story, arcs, seeds and pacing the Director keeps" },
  Sub: DirectorSettings,
  Stage: DirectorFab,
};
