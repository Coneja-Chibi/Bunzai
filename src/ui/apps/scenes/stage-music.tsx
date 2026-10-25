/**
 * The Stage wing's Music tab (RoleCall's MoodMusicWingPanel). Shown while the Mood Music Prop is on for the scene, which is RoleCall's "Mood
 * Music" card in its Props wing switching the tab on (right-wing-groups.ts:108-115). The panel is stage-music-panel.tsx.
 */
import type { JSX } from "react";
import { MOOD_MUSIC_PROP, musicTabShown } from "./stage-music-core";
import { MusicPanel } from "./stage-music-panel";
import type { StageTab, StageTabProps } from "./stage-tabs";

function Music({ ctx }: StageTabProps): JSX.Element {
  return <MusicPanel ctx={ctx} />;
}

export const MUSIC_TAB: StageTab = { id: "music", label: "Music", visible: ({ propsOn, prefs }) => propsOn?.includes(MOOD_MUSIC_PROP) === true && (!prefs || musicTabShown(prefs)), Panel: Music };
