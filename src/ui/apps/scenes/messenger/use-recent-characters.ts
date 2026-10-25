/**
 * The Messenger's RECENT CHARACTERS (RoleCall `useDiscordRecents.ts` + `lib/discord/recents.ts`): each character's newest scene, newest first (sorted here by updatedAt as recents.ts does),
 * at most 40 (recents.ts:62-69). Bunraku has no lighter source than the Scenes list and no scene-change event, and listScenes reads every chat, so the answer is loaded once per
 * session and shared by every Messenger mount (opening another scene reuses it). It is read again after RECENTS_TTL_MS, when the library locks, or when the person presses Try again.
 */
import { useCallback, useEffect, useState } from "react";
import type { AppContext } from "../../../app-contract";
import { LIBRARY_LOCKED_EVENT } from "../../../_shared/api-fetch";
import type { SceneSummary } from "../../../../studio/scenes";

export const MAX_RECENTS = 40;
export const RECENTS_TTL_MS = 5 * 60_000;
export const RECENTS_ERROR = "Could not load recent characters. Try again.";

/** One row per character: the newest scene of each, at most 40. */
export function recentCharacters(scenes: readonly SceneSummary[]): SceneSummary[] {
  const seen = new Set<string>();
  return [...scenes].sort((a, b) => b.updatedAt - a.updatedAt).filter((s) => {
    const id = s.cast.character.id;
    if (s.castMissing || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, MAX_RECENTS);
}

export type Recents = { state: "loading" } | { state: "failed" } | { state: "ready"; rows: SceneSummary[] };

let held: { rows: SceneSummary[]; at: number } | null = null;
let loading: Promise<SceneSummary[]> | null = null;
/** Drops what was loaded (tests; the library locking). */
export const forgetRecents = (): void => { held = null; loading = null; };
if (typeof window !== "undefined") window.addEventListener(LIBRARY_LOCKED_EVENT, forgetRecents);

function load(api: AppContext["api"], force: boolean): Promise<SceneSummary[]> {
  if (!force && held && Date.now() - held.at < RECENTS_TTL_MS) return Promise.resolve(held.rows);
  if (!force && loading) return loading;
  const p = api.listScenes().then((scenes) => {
    const rows = recentCharacters(scenes);
    if (loading === p) held = { rows, at: Date.now() };
    return rows;
  }).finally(() => { if (loading === p) loading = null; });
  loading = p;
  return p;
}

export function useRecentCharacters(api: AppContext["api"]): { recents: Recents; retry(): void } {
  const [recents, setRecents] = useState<Recents>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRecents(held && attempt === 0 && Date.now() - held.at < RECENTS_TTL_MS ? { state: "ready", rows: held.rows } : { state: "loading" });
    load(api, attempt > 0).then(
      (rows) => live && setRecents({ state: "ready", rows }),
      () => live && setRecents({ state: "failed" }),
    );
    return () => { live = false; };
  }, [api, attempt]);
  return { recents, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
