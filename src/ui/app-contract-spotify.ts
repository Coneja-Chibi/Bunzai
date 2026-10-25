/** The Spotify routes an app may call through the local server, which holds the link and the token; the page never sees either. */
export type SpotifyPath = `/api/spotify/${string}`;
export interface SpotifyApi {
  spotifyGet<T>(path: SpotifyPath): Promise<T>;
  spotifyPost(path: SpotifyPath, body: unknown): Promise<unknown>;
}
