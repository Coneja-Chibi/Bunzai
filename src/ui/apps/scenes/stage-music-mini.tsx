/**
 * Mood Music's mini player, the Prop's Stage piece: RoleCall's bar above the composer (MoodMusicMiniPlayer.tsx:17-98), shown only once a
 * track is set (VVS-482) with the track and its pack, Play or Pause, Next and the chevron that opens the Music tab. It also holds the
 * audio element for as long as the Prop is on, so the music outlives the wing being shut. RoleCall's mood chip needs the Story
 * Director and is not drawn.
 */
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import type { MusicPlayer } from "./stage-music-player";
import { openStageTab } from "./stage-open";
import { sharedMusic, useStageMusic } from "./use-stage-music";
import { IconButton } from "../../components/button";

export function MusicMini({ ctx, player = sharedMusic, onExpand = () => openStageTab("music") }: { ctx: AppContext; player?: MusicPlayer; onExpand?: () => void }): JSX.Element | null {
  const { state } = useStageMusic(ctx, player);
  if (!state.track) return null;
  return (
    <div className="mm-mini-bar" data-part="scene.stage.music.mini">
      <div className="mm-mini-tile"><Ic name="lucide:music" size={16} /></div>
      <div className="mm-mini-text">
        <p>{state.track.title}</p>
        <p>{state.track.packName}</p>
      </div>
      {state.error && <div className="mm-mini-err">{state.error}</div>}
      <div className="mm-mini-btns">
        <IconButton variant="quiet" size="sm" icon={state.playing ? "lucide:pause" : "lucide:play"} label={state.playing ? "Pause mood music" : "Play mood music"} onClick={() => player.toggle()} />
        <IconButton variant="quiet" size="sm" icon="lucide:skip-forward" label="Next mood music track" onClick={() => player.next()} />
        <IconButton variant="quiet" size="sm" icon="lucide:chevron-up" label="Open mood music panel" onClick={onExpand} />
      </div>
    </div>
  );
}
