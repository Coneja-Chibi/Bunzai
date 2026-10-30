/**
 * The Dramaturg as a registered scene Prop (specs/stage/dramaturg.md; RoleCall's Dramaturg, VAUDEVILLE docs/dramaturg-agent-spec.md): an
 * out-of-character consultant that reads the scene and changes nothing in it. On means the Prop is in the scene's Props (ChatStore rule 21);
 * while it is on it has its own wing on the right rail (`rail`) and its settings under its row, and its panel is a pop-out kind that the wing,
 * the row's gear and a float all show. It calls the person's model when asked (reach "model") and writes only its own conversation, never
 * library data. Registered in props/registry.ts.
 */
import type { SceneProp } from "../prop-contract";
import { DRAMATURG_PROP_ID } from "../../../../../core/dramaturg/settings";
import { dramaturgPanelPopout, DRAMATURG_TONE } from "./dramaturg-panel";
import { DramaturgSettings } from "./dramaturg-settings";

export const dramaturgProp: SceneProp = {
  id: DRAMATURG_PROP_ID,
  reach: "model",
  name: "Dramaturg",
  tier: "Out of character",
  blurb: "A consultant beside the scene: ask why a character did that, whether it fits the card, what could come next. Reads everything, changes nothing.",
  note: "The Dramaturg answers only when asked, with your model. It reads the scene and never writes to it; clearing its conversation leaves the scene as it is.",
  tone: DRAMATURG_TONE,
  icon: "lucide:book-open",
  tip: {
    description: "An out-of-character consultant for this scene. It reads the card, the persona, the preset's enabled blocks, the lore and the visible messages, and talks with you about them.",
    bullets: [
      "Adds a Dramaturg wing on the right rail, with its own conversation for this scene.",
      "Read-only: it cannot change the scene, a card, the lore or the preset.",
      "Uses the scene's model unless you pick one for it.",
    ],
  },
  panel: dramaturgPanelPopout,
  rail: { blurb: "Ask about the scene, out of character" },
  Sub: DramaturgSettings,
};
