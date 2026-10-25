/**
 * Mood Music's pure half. RoleCall plays a catalog of hosted tracks plus the person's own (MoodMusicContext.tsx, MoodMusicWingPanel.tsx);
 * Bunraku plays the sound files in the person's packs, so a "category" is a pack and a track is a pack item whose media type is audio
 * (an audio item rides the pack entity as `{ id, label, ref, mime }`, the same shape a backdrop picture does). Next walks the current
 * pack and wraps (MoodMusicContext.tsx:390-403); volume is 0 to 1 and starts at 0.6 (MoodMusicContext.tsx:71-80).
 */
import { parseUploadedRef } from "../../../entities/piece-parts-blob";
import type { SpritePackItem } from "../../../core/media";
import { refSha, type BackdropPack } from "./scene-backdrop-core";

/** The Props wing's id for Mood Music (ChatStore rule 21 id format). */
export const MOOD_MUSIC_PROP = "mood-music";
/** "Show Music tab" (RoleCall's showMoodMusicTab, on unless set false): a per-user pref; the Music tab hides, playback stays. */
export const MUSIC_TAB_PREF = "scenes.stage.musicTab";
export const musicTabShown = (prefs: { get(key: string): unknown }): boolean => prefs.get(MUSIC_TAB_PREF) !== false;
/** The person's volume, one per app (RoleCall keeps it per browser in localStorage, MoodMusicContext.tsx:40). */
export const VOLUME_KEY = "scenes.musicVolume";
export const DEFAULT_VOLUME = 0.6;

export interface Track { id: string; packId: string; packName: string; itemId: string; title: string; sha: string }
export interface TrackGroup { packId: string; name: string; tracks: Track[] }

/** A pack item that is a sound file: its stored media type (or its ref's) is audio. */
export const isSound = (item: SpritePackItem): boolean => (item.mime ?? parseUploadedRef(item.ref)?.mime ?? "").startsWith("audio/");

export function volumeOf(pref: unknown): number {
  return typeof pref === "number" && Number.isFinite(pref) ? Math.min(1, Math.max(0, pref)) : DEFAULT_VOLUME;
}

/** The sound files a pack holds, each playable from the asset route (a sound with no stored file is left out). */
export function groupOf(pack: BackdropPack): TrackGroup | null {
  const tracks: Track[] = [];
  for (const item of pack.items) {
    const sha = isSound(item) ? refSha(item.ref) : null;
    if (sha) tracks.push({ id: `${pack.id}:${item.id}`, packId: pack.id, packName: pack.name, itemId: item.id, title: item.label, sha });
  }
  return tracks.length > 0 ? { packId: pack.id, name: pack.name, tracks } : null;
}

/** The track after `current` in its pack's tracks (the queue), wrapping; null when the queue no longer holds it. */
export function nextOf(tracks: readonly Track[], current: Track): Track | null {
  const at = tracks.findIndex((t) => t.id === current.id);
  return at < 0 ? null : tracks[(at + 1) % tracks.length] ?? null;
}

export const sourceOf = (track: Track): string => `/api/asset/${track.sha}`;
