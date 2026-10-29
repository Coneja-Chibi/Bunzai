/**
 * The Messenger's scenes and RECENT CHARACTERS (RoleCall `useDiscordRecents.ts` + `lib/discord/recents.ts`): each character's newest scene, newest first (sorted here by updatedAt as recents.ts
 * does), at most 40 (recents.ts:62-69). Bunzai has no lighter source than the Scenes list and no scene-change event, and listScenes reads every chat, so the whole list is loaded once per
 * session and shared by every Messenger mount (opening another scene reuses it); the rail's recents and a character's own scene list are both derived from it, never read twice. It is read
 * again after RECENTS_TTL_MS, when the library locks, or when the person presses Try again. The characters a person left are filtered when the recents are derived, not in the cache, so Leave
 * shows at once.
 */
import { useCallback, useEffect, useState } from "react";
import type { AppContext } from "../../../app-contract";
import { LIBRARY_LOCKED_EVENT } from "../../../_shared/api-fetch";
import type { SceneSummary } from "../../../../studio/scenes";

export const MAX_RECENTS = 40;
export const RECENTS_TTL_MS = 5 * 60_000;
export const RECENTS_ERROR = "Could not load recent characters. Try again.";

/** One row per character: the newest scene of each, at most 40, without the characters in `hidden` (except `keep`, the open scene's, which stays reachable). */
export function recentCharacters(scenes: readonly SceneSummary[], hidden: readonly string[] = [], keep = ""): SceneSummary[] {
  const seen = new Set<string>();
  return [...scenes].sort((a, b) => b.updatedAt - a.updatedAt).filter((s) => {
    const id = s.cast.character.id;
    if (s.castMissing || seen.has(id) || (id !== keep && hidden.includes(id))) return false;
    seen.add(id);
    return true;
  }).slice(0, MAX_RECENTS);
}

/** Every scene of one character, newest first. */
export const scenesOfCharacter = (scenes: readonly SceneSummary[], characterId: string): SceneSummary[] =>
  scenes.filter((s) => !s.castMissing && s.cast.character.id === characterId).sort((a, b) => b.updatedAt - a.updatedAt);

export type Recents = { state: "loading" } | { state: "failed" } | { state: "ready"; scenes: SceneSummary[] };

let held: { scenes: SceneSummary[]; at: number } | null = null;
let loading: Promise<SceneSummary[]> | null = null;
/** Drops what was loaded (tests; the library locking). */
export const forgetRecents = (): void => { held = null; loading = null; };
if (typeof window !== "undefined") window.addEventListener(LIBRARY_LOCKED_EVENT, forgetRecents);

function load(api: AppContext["api"], force: boolean): Promise<SceneSummary[]> {
  if (!force && held && Date.now() - held.at < RECENTS_TTL_MS) return Promise.resolve(held.scenes);
  if (!force && loading) return loading;
  const p = api.listScenes().then((scenes) => {
    if (loading === p) held = { scenes, at: Date.now() };
    return scenes;
  }).finally(() => { if (loading === p) loading = null; });
  loading = p;
  return p;
}

export function useRecentCharacters(api: AppContext["api"]): { recents: Recents; retry(): void } {
  const [recents, setRecents] = useState<Recents>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRecents(held && attempt === 0 && Date.now() - held.at < RECENTS_TTL_MS ? { state: "ready", scenes: held.scenes } : { state: "loading" });
    load(api, attempt > 0).then(
      (scenes) => live && setRecents({ state: "ready", scenes }),
      () => live && setRecents({ state: "failed" }),
    );
    return () => { live = false; };
  }, [api, attempt]);
  return { recents, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
