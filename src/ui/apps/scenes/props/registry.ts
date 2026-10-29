/**
 * The Props registry - the ONE seam for drop-in props (a browser bundle cannot glob). Adding a prop =
 * one file in src/ui/apps/scenes/props/ + one import line here; nothing else is edited anywhere.
 * Tests register a fake prop by passing an explicit list to the components instead; a test prop never
 * belongs here.
 */
import type { SceneProp } from "./prop-contract";
import { dialogueColorsProp } from "./dialogue-colors";
import { moodMusicProp } from "./mood-music";
import { spotifyProp } from "./spotify";
import { legacyProps } from "./trackers/legacy";
import { storyboardProps } from "./trackers/storyboards";
import { trackHareProp } from "./trackhare";
import { directorProp } from "./story-director";

/** The wing's order, RoleCall's catalog order first (Mood Music, then Character Voices' colours), Bunzai's own after. */
const PROPS: SceneProp[] = [moodMusicProp, dialogueColorsProp, directorProp, ...storyboardProps, ...legacyProps, spotifyProp, trackHareProp];

export const sceneProps = (): SceneProp[] => [...PROPS];
