/**
 * Spotify's mini player, the Prop's Stage piece: RoleCall's bar above the composer (SpotifyMiniPlayer.tsx:20-123), 48px tall with the album
 * art, the track and its artists ("No track playing" when nothing is), Play or Pause, Next, and the chevron that opens the Spotify tab.
 * It also keeps the poll running while the Prop is on. It draws nothing until Spotify is connected.
 */
import type { JSX } from "react";
import { Ic } from "../../_shared/ic";
import { safeArt } from "./stage-spotify-core";
import type { SpotifyFeed } from "./stage-spotify-feed";
import { openStageTab } from "./stage-open";
import { useStageSpotify } from "./use-stage-spotify";

export function SpotifyMini({ feed, onExpand = () => openStageTab("spotify") }: { feed: SpotifyFeed; onExpand?: () => void }): JSX.Element | null {
  const { state } = useStageSpotify(feed);
  if (state.phase !== "ready") return null;
  const track = state.playback?.track ?? null;
  const art = safeArt(track?.art);
  return (
    <div className="mm-mini-bar sp-mini" data-part="scene.stage.spotify.mini">
      <div className="sp-mini-art">{art ? <img src={art} alt="Album art" /> : <Ic name="lucide:music" size={16} />}</div>
      <div className="mm-mini-text">
        {track ? <><p>{track.name}</p><p>{track.artists.join(", ")}</p></> : <p className="sp-mini-none">No track playing</p>}
      </div>
      <div className="mm-mini-btns">
        <button type="button" disabled={!track} onClick={() => void feed.toggle()} aria-label={state.playback?.playing ? "Pause" : "Play"}><Ic name={state.playback?.playing ? "lucide:pause" : "lucide:play"} size={16} /></button>
        <button type="button" disabled={!track} onClick={() => void feed.act({ action: "next" })} aria-label="Skip to next"><Ic name="lucide:skip-forward" size={16} /></button>
        <button type="button" onClick={onExpand} aria-label="Open Spotify panel"><Ic name="lucide:chevron-up" size={16} /></button>
      </div>
    </div>
  );
}
