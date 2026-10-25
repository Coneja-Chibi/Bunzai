/**
 * The Final Cut wing's data for the Regex tab: the library's regex sets, loaded when the wing opens (the tab shows its active count
 * before it is opened), and the scene's own switched-on sets (ChatStore rule 42). Scene writes go one after another so a quick second
 * switch can never be overtaken by a slow first one, and each is made from the list as last asked.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../_shared/error-message";
import type { AsyncState } from "../../_shared/async-state";
import { withGuide as withSet } from "./guides-core";

export type RegexLibrary = AsyncState<{ sets: StudioEntitySummary[] }>;

export interface SceneRegexPicks {
  library: RegexLibrary;
  reload(): void;
  /** The scene's switched-on set ids, in the order they run. */
  on: readonly string[];
  /** Switches one set on (last) or off for the scene. */
  setOn(id: string, on: boolean): Promise<void>;
  /** Replaces the scene's list (a drag reorder). */
  replace(ids: string[]): Promise<void>;
  /** The sets hung on the Wardrobe's rack (rule 42). */
  rack: readonly string[];
  /** Wears a rack set (on, off the rack) or hangs it (off, onto the rack), in one write. */
  wear(id: string, worn: boolean): Promise<void>;
}

export function useSceneRegexPicks(ctx: AppContext, chat: Chat, onChanged: (chat: Chat) => void): SceneRegexPicks {
  const [library, setLibrary] = useState<RegexLibrary>({ state: "loading" });
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const held = useRef(chat);
  held.current = chat;
  const asked = useRef<string[] | null>(null);
  const waiting = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const sets = await api.current.listEntities("regex");
      if (mounted.current) setLibrary({ state: "ready", sets });
    } catch (e) {
      if (mounted.current) setLibrary({ state: "failed", why: toErrorMessage(e, "the regex sets could not be read") });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const write = (sets: string[], rack?: string[]): Promise<void> => {
    asked.current = sets;
    waiting.current++;
    const done = queue.current.then(async () => {
      const next = await api.current.setSceneRegex(held.current.id, { sets, ...(rack ? { rack } : {}) });
      held.current = next;
      changed.current(next);
    });
    queue.current = done.catch(() => undefined);
    return done.finally(() => { if (--waiting.current === 0) asked.current = null; });
  };
  return {
    library,
    reload: () => { setLibrary({ state: "loading" }); void load(); },
    on: chat.regex?.sets ?? [],
    setOn: (id, enabled) => write(withSet(asked.current ?? held.current.regex?.sets ?? [], id, enabled)),
    replace: (ids) => write(ids),
    rack: chat.regex?.rack ?? [],
    wear: (id, worn) => write(withSet(asked.current ?? held.current.regex?.sets ?? [], id, worn), worn ? (held.current.regex?.rack ?? []).filter((x) => x !== id) : withSet(held.current.regex?.rack ?? [], id, true)),
  };
}
