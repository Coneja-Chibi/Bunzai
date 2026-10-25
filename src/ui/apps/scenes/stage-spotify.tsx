/**
 * The Stage wing's Spotify tab (RoleCall's SpotifyWingPanel). Shown while the Spotify Prop is on for the scene; the Props wing's own row is the
 * switch, so turning it off never strands the person (RoleCall hid the tab and the only way back was inside it, F7). The account itself is
 * connected in Settings > Spotify, and the tab says so when it is not. The panel is stage-spotify-panel.tsx.
 */
import type { JSX } from "react";
import { SPOTIFY_PROP } from "./stage-spotify-core";
import { SpotifyPanel } from "./stage-spotify-panel";
import type { StageTab, StageTabProps } from "./stage-tabs";
import { spotifyFeedFor } from "./use-stage-spotify";

function Spotify({ ctx }: StageTabProps): JSX.Element {
  return <SpotifyPanel feed={spotifyFeedFor(ctx.api)} />;
}

export const SPOTIFY_TAB: StageTab = { id: "spotify", label: "Spotify", visible: ({ propsOn }) => propsOn?.includes(SPOTIFY_PROP) === true, Panel: Spotify };
