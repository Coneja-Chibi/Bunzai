/**
 * The one audio element behind Mood Music (RoleCall MoodMusicContext.tsx:141-181, 243-335): `loop = true`, `preload = "none"`, a play the
 * browser refuses shows its message and stays paused, Stop clears the track, a different track swaps `src` and plays. The element is
 * shared by the Music tab and the mini player, so it lives here in a tiny store, not in either component; it is made when the first
 * of them mounts and dropped (stopped) when the last unmounts, which is how switching the Prop off silences it. The track is in
 * memory only; the volume is the caller's to persist. Tracks stream from `/api/asset/<sha>` through the browser's own audio
 * loader; this file never reads the file's bytes. RoleCall does not crossfade between tracks, so neither does this.
 */
import { DEFAULT_VOLUME, nextOf, sourceOf, type Track } from "./stage-music-core";

/** The slice of HTMLAudioElement the player drives, so a test can stand in for it. */
export interface AudioLike {
  src: string; loop: boolean; volume: number; preload: string;
  play(): Promise<void>; pause(): void; load(): void; removeAttribute(name: string): void;
  addEventListener(type: "play" | "pause", fn: () => void): void;
  removeEventListener(type: "play" | "pause", fn: () => void): void;
}
/** `queue` is the pack's tracks the current one was picked from: what Next walks. */
export interface MusicState { track: Track | null; queue: readonly Track[]; playing: boolean; volume: number; error: string | null }

export function createMusicPlayer(makeAudio: () => AudioLike, initialVolume = DEFAULT_VOLUME) {
  let state: MusicState = { track: null, queue: [], playing: false, volume: initialVolume, error: null };
  let audio: AudioLike | null = null;
  let users = 0;
  let detach = (): void => undefined;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<MusicState>): void => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

  const stop = (): void => {
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    set({ track: null, queue: [], playing: false, error: null });
  };

  async function play(track: Track, queue: readonly Track[] = state.queue): Promise<void> {
    set({ error: null });
    if (!audio) { set({ error: "Audio player is not ready." }); return; }
    const src = sourceOf(track);
    if (!audio.src.endsWith(src)) { audio.src = src; audio.load(); }
    audio.loop = true;
    audio.volume = state.volume;
    set({ track, queue });
    try {
      await audio.play();
      set({ playing: true });
    } catch (e) {
      set({ error: e instanceof Error && e.message ? e.message : "Browser blocked autoplay.", playing: false });
    }
  }

  return {
    get: (): MusicState => state,
    subscribe(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); },
    /** Make the element on first use; the returned release drops it (and stops the music) when the last user lets go. */
    acquire(): () => void {
      if (users++ === 0) {
        audio = makeAudio();
        audio.loop = true; audio.preload = "none"; audio.volume = state.volume;
        const on = (): void => set({ playing: true });
        const off = (): void => set({ playing: false });
        audio.addEventListener("play", on); audio.addEventListener("pause", off);
        const el = audio;
        detach = () => { el.removeEventListener("play", on); el.removeEventListener("pause", off); };
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (--users > 0) return;
        stop();
        detach();
        audio = null;
      };
    },
    play,
    /** Pause when playing; otherwise resume the current track (RoleCall StandardLayout.tsx:282-294). */
    toggle(): void {
      if (state.playing) { audio?.pause(); set({ playing: false }); }
      else if (state.track) void play(state.track);
    },
    stop,
    /** The next track in the queue, wrapping (RoleCall MoodMusicContext.tsx:390-403). */
    next(): void {
      const after = state.track ? nextOf(state.queue, state.track) : null;
      if (after) void play(after);
    },
    setVolume(value: number): void {
      const volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
      if (audio) audio.volume = volume;
      set({ volume });
    },
  };
}

export type MusicPlayer = ReturnType<typeof createMusicPlayer>;
