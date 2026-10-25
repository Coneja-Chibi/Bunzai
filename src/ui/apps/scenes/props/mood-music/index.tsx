/**
 * Mood Music as a registered scene Prop (RoleCall's Props wing "Mood Music" card, StagecraftExtensions.tsx:195, switches the Music tab on). While it
 * is on the Stage wing shows the Music tab and the mini player draws above the composer; off by default, as in RoleCall. On and off is the
 * Props wing's own per-scene switch (ChatStore rule 21), so Mood Music keeps no state of its own. Registered in props/registry.ts.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { SceneProp } from "../prop-contract";
import { openStageTab } from "../../stage-open";
import { MusicTabRow } from "./music-tab-row";
import { MOOD_MUSIC_PROP } from "../../stage-music-core";
import { MusicMini } from "../../stage-music-mini";

function MoodMusicStage({ ctx }: { ctx: AppContext }): JSX.Element {
  return <MusicMini ctx={ctx} />;
}

export const moodMusicProp: SceneProp = {
  id: MOOD_MUSIC_PROP,
  name: "Mood Music",
  reach: "egress",
  writes: true,
  tier: "Local ambience",
  tip: {
    description: "Enables local scene-aware background music for this chat.",
    bullets: ["Off: hides the mini-player.", "On: you can play tracks from the sound files in your packs.", "The Music tab can be hidden while playback remains active."],
  },
  gear: () => openStageTab("music"),
  Sub: MusicTabRow,
  blurb: "Background music for the scene, played from the sound files in your packs.",
  note: "Add sound files to a pack in the Stage wing's Music tab. The player appears above the composer once a track is picked.",
  tone: "var(--stage-ok)",
  icon: "lucide:music-2",
  Stage: MoodMusicStage,
};
