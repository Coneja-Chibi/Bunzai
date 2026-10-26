/**
 * "Play on scene open" and the memory it needs. Held by the Mood Music mini player, which is mounted for as long as the Prop is on in the scene: it keeps the last track played
 * (pack and item ids, an app preference) and, when the person has switched autoplay on and nothing is playing yet, starts that track once. A browser that refuses sound before a
 * click leaves the track set and paused with the player's own message and its Play button, so the refusal is never silent.
 */
import { useEffect, useRef } from "react";
import type { AppContext } from "../../app-contract";
import { AUTOPLAY_KEY, LAST_TRACK_KEY, autoplayOn, findTrack, lastTrackOf, type Track } from "./stage-music-core";
import type { MusicPlayer } from "./stage-music-player";
import { loadMusicLibrary } from "./use-music-library";

export function useMusicAutoplay(ctx: AppContext, player: MusicPlayer, track: Track | null): void {
  const prefs = useRef(ctx.prefs);
  prefs.current = ctx.prefs;
  useEffect(() => {
    if (!track) return;
    const saved = lastTrackOf(prefs.current.get(LAST_TRACK_KEY));
    if (saved?.packId !== track.packId || saved.itemId !== track.itemId) prefs.current.set(LAST_TRACK_KEY, { packId: track.packId, itemId: track.itemId });
  }, [track]);
  useEffect(() => {
    const ref = lastTrackOf(prefs.current.get(LAST_TRACK_KEY));
    if (!autoplayOn(prefs.current.get(AUTOPLAY_KEY)) || !ref || player.get().track) return undefined;
    let live = true;
    void loadMusicLibrary(ctx).then(({ groups }) => {
      const found = findTrack(groups, ref);
      if (live && found && !player.get().track) void player.play(found.track, found.group.tracks);
    });
    return () => { live = false; };
  }, [ctx, player]);
}
