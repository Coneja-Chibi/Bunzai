/**
 * Joins a component to the shared Mood Music player (stage-music-player.ts). Mounting acquires the one audio element (and applies the
 * person's saved volume the first time); unmounting releases it, and the last release stops the music. The volume writer saves the
 * number to the app preference as well as moving the element, so it survives a restart (RoleCall saved it per browser).
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { AppContext } from "../../app-contract";
import { VOLUME_KEY, volumeOf } from "./stage-music-core";
import { createMusicPlayer, type AudioLike, type MusicPlayer, type MusicState } from "./stage-music-player";

/** The page's one player. Tests pass their own instead. */
export const sharedMusic: MusicPlayer = createMusicPlayer(() => {
  const audio = new Audio();
  return audio as unknown as AudioLike;
});

export function useStageMusic(ctx: AppContext, player: MusicPlayer = sharedMusic): { state: MusicState; setVolume(value: number): void } {
  // Held by a ref: a new context object must never release the element, because the last release stops the music.
  const prefs = useRef(ctx.prefs);
  prefs.current = ctx.prefs;
  useEffect(() => {
    const release = player.acquire();
    player.setVolume(volumeOf(prefs.current.get(VOLUME_KEY)));
    return release;
  }, [player]);
  const state = useSyncExternalStore(player.subscribe, player.get);
  const setVolume = useCallback((value: number) => { player.setVolume(value); prefs.current.set(VOLUME_KEY, player.get().volume); }, [player]);
  return { state, setVolume };
}
