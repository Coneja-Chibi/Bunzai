/**
 * Dialogue Colors as a registered scene Prop: the colours half of RoleCall's Character Voices (stageSettings.characterVoicesEnabled and
 * characterVoiceColorsEnabled, `ChatMessageShell.tsx:437`; its text-to-speech half is out of scope). While it is on, each quote in a reply
 * takes its speaker's colour from the scene's participants (the Cast wing's Participants tab), and that tab's colour editors work.
 * Off by default, as in RoleCall. Registered in props/registry.ts.
 */
import type { SceneProp } from "../prop-contract";

export const DIALOGUE_COLORS_PROP = "dialogue-colors";

export const dialogueColorsProp: SceneProp = {
  id: DIALOGUE_COLORS_PROP,
  reach: "none",
  name: "Dialogue Colors",
  tier: "Dialogue color",
  tip: {
    description: "Controls per-character presentation for chat replies: dialogue colors.",
    bullets: ["Signature Colors tints quoted dialogue by speaker."],
  },
  blurb: "Per-speaker dialogue tinting: each quoted line in a reply takes the colour of the participant who said it.",
  note: "Set each participant's colours in the Cast wing, Participants tab.",
  tone: "var(--deck-persona)",
  icon: "lucide:audio-lines",
};
