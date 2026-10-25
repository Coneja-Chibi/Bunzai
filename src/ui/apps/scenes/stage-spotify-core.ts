/**
 * Spotify's pure half in the Stage wing, from RoleCall's SpotifyWingPanel.tsx: the clock text (`formatMs`, :36-41), the progress
 * percentage and the click-to-seek maths (:147-149, :245-249), which device glyph a device type gets (:43-48), and the wire shapes the
 * local server answers with (src/ui/spotify/link.ts). The page never holds a token; it only sends commands and shows these facts.
 */
export const SPOTIFY_PROP = "spotify";
/** RoleCall polls playback every 5 s and devices every 30 s, and not while the tab is hidden (SpotifyContext.tsx:43-50, 318-349). */
export const PLAYBACK_POLL_MS = 5_000;
export const DEVICES_POLL_MS = 30_000;

export interface Device { id: string; name: string; type: string; active: boolean; volume: number | null }
export interface Playback {
  playing: boolean; progressMs: number;
  track: { name: string; artists: string[]; durationMs: number; art: string | null } | null;
  device: Device | null;
}
export interface SpotifyStatus { clientId: string | null; connected: boolean; premium: boolean | null; name: string | null; redirectUri: string; registerUri: string }

export function formatMs(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, "0")}`;
}

export const progressPct = (progressMs: number, durationMs: number): number => (durationMs > 0 ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0);

/** A click at `x` along a bar `width` wide, as a position in the track (RoleCall rounds to a millisecond). */
export function seekTo(x: number, left: number, width: number, durationMs: number): number {
  return width > 0 ? Math.round(Math.max(0, Math.min(1, (x - left) / width)) * durationMs) : 0;
}

/** RoleCall: phones, speakers and everything else (a computer). */
export function deviceGlyph(type: string): "lucide:smartphone" | "lucide:speaker" | "lucide:monitor" {
  const t = type.toLowerCase();
  return t === "smartphone" || t === "phone" ? "lucide:smartphone" : t === "speaker" ? "lucide:speaker" : "lucide:monitor";
}

/** Only https art is drawn (RoleCall SpotifyWingPanel.tsx:151-153); the server already filters, this keeps the page honest too. */
export const safeArt = (url: string | null | undefined): string | null => (url?.startsWith("https://") ? url : null);
