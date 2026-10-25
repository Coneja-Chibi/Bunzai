/**
 * Spotify as a registered scene Prop. RoleCall hides the Spotify tab and mini player when a chat's `spotifyMode` is "off" and offers no way
 * back, because the only switch lived inside that tab (RightWingPanelContent.tsx:590-601; flaw F7). Here the switch is the Props wing's own
 * row, which is always there: on, the Stage wing shows the Spotify tab and the mini player draws above the composer; off, both go and the
 * row stays to turn them on again. The account itself (Client ID, Connect) is Settings > Spotify. Registered in props/registry.ts.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { SceneProp } from "../prop-contract";
import { SPOTIFY_PROP } from "../../stage-spotify-core";
import { SpotifyMini } from "../../stage-spotify-mini";
import { openStageTab } from "../../stage-open";
import { spotifyFeedFor } from "../../use-stage-spotify";

function SpotifyStage({ ctx }: { ctx: AppContext }): JSX.Element {
  return <SpotifyMini feed={spotifyFeedFor(ctx.api)} />;
}

export const spotifyProp: SceneProp = {
  id: SPOTIFY_PROP,
  name: "Spotify",
  reach: "egress",
  tier: "Music controller",
  gear: () => openStageTab("spotify"),
  blurb: "Control the Spotify app you already have open: play, pause, skip, volume and which device it plays on.",
  note: "Connect your account in Settings, under Spotify. Controlling playback needs Spotify Premium.",
  tone: "var(--stage-ok)",
  icon: "lucide:music",
  Stage: SpotifyStage,
};
