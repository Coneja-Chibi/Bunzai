/** Music and Spotify: volume and the tab switch are pref rows; the track library and the player are the Stage panels (drill rows); the Spotify link form is a protected page. */
import type { JSX } from "react";
import { DrillRow } from "../../frames/settings-rows";
import { useSettingsNav } from "../../frames/settings-window";
import type { OpenProgram } from "../scopes";
import { useLoaded } from "./use-loaded";
import { isRecord } from "../../../../../../core/guards";
import type { AppContext } from "../../../../../app-contract";

interface SpotifyStatus { connected: boolean; name: string | null }

export function MusicDrills({ open, library }: { open: OpenProgram; library: boolean }): JSX.Element | null {
  return library ? <div data-part="scene.messenger.settings.rows"><DrillRow label="Track library and player" description="Add tracks, rename them, and play." onOpen={() => open("mood-music")} /></div> : null;
}

export function SpotifyRows({ ctx, open, player }: { ctx: AppContext; open: OpenProgram; player: boolean }): JSX.Element {
  const nav = useSettingsNav();
  const status = useLoaded(() => ctx.api.spotifyGet<SpotifyStatus>("/api/spotify/status"), (v): v is SpotifyStatus => isRecord(v) && typeof v["connected"] === "boolean").value;
  return (
    <div data-part="scene.messenger.settings.rows">
      <DrillRow label="Spotify link" description="Your own Spotify app's Client ID, sign in and disconnect." {...(status ? { value: status.connected ? `Connected${status.name ? ` as ${status.name}` : ""}` : "Not connected" } : {})} onOpen={() => nav.open("user.spotify")} />
      {player && <DrillRow label="Player" description="Playback, devices and volume for this scene." onOpen={() => open("spotify")} />}
    </div>
  );
}
