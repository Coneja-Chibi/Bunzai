/**
 * Joins a component to the shared Spotify feed (stage-spotify-feed.ts). The feed's page-side caller is the app contract's Spotify
 * routes (`ctx.api.spotifyGet` and `spotifyPost`), so no scene file calls the server itself. Mounting watches playback;
 * `devices: true` also keeps the device list fresh.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { SpotifyApi } from "../../app-contract-spotify";
import { createSpotifyFeed, type SpotifyFeed, type SpotifyState } from "./stage-spotify-feed";

const feeds = new WeakMap<SpotifyApi, SpotifyFeed>();

/** The page's one feed for this api. Tests pass their own feed to the components instead. */
export function spotifyFeedFor(api: SpotifyApi): SpotifyFeed {
  let feed = feeds.get(api);
  if (!feed) {
    feed = createSpotifyFeed({ get: (path) => api.spotifyGet(path), post: (path, body) => api.spotifyPost(path, body) });
    feeds.set(api, feed);
  }
  return feed;
}

export function useStageSpotify(feed: SpotifyFeed, opts: { devices?: boolean } = {}): { state: SpotifyState; feed: SpotifyFeed } {
  const devices = opts.devices === true;
  useEffect(() => {
    const stop = feed.watch();
    const stopDevices = devices ? feed.watchDevices() : undefined;
    return () => { stop(); stopDevices?.(); };
  }, [feed, devices]);
  return { state: useSyncExternalStore(feed.subscribe, feed.get), feed };
}
