/**
 * The Prompting wing's data for the Guides and Scene Note tabs: the guide library, loaded when the wing
 * opens (the Guides tab shows its active count before it is opened), and the scene's own switched-on
 * guides and note (ChatStore rule 37). Scene writes go one after another so a quick second change can never
 * be overtaken by a slow first one; the store merges each patch, so a guide switch and a note edit never
 * overwrite each other.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { GuideInput, GuideRecord } from "../../../core/guide-record";
import type { Chat, ChatPromptingPatch } from "../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../_shared/error-message";
import { withGuide } from "./guides-core";
import type { AsyncState } from "../../_shared/async-state";

export type GuideLibrary = AsyncState<{ guides: GuideRecord[] }>;

export interface ScenePrompting {
  library: GuideLibrary;
  reload(): void;
  /** Makes or changes a guide, then refreshes the list; answers the saved guide. */
  save(guide: GuideInput & { id?: string }): Promise<GuideRecord>;
  remove(id: string): Promise<void>;
  /** Changes the scene's guides or note; rejects with the reason when it could not be saved. */
  patch(change: ChatPromptingPatch): Promise<void>;
  /** Switches one guide on (last) or off for the scene, from the list as last asked, so two quick switches never lose one. */
  setGuide(id: string, on: boolean): Promise<void>;
}

export function useScenePrompting(ctx: AppContext, chat: Chat, onChanged: (chat: Chat) => void): ScenePrompting {
  const [library, setLibrary] = useState<GuideLibrary>({ state: "loading" });
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const held = useRef(chat);
  held.current = chat;
  /** The guides list as last asked while writes are still waiting; null once they have all landed. */
  const asked = useRef<string[] | null>(null);
  const waiting = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async () => {
    try {
      const guides = await api.current.listGuides();
      if (mounted.current) setLibrary({ state: "ready", guides });
    } catch (e) {
      if (mounted.current) setLibrary({ state: "failed", why: toErrorMessage(e, "the guides could not be read") });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const write = (change: ChatPromptingPatch): Promise<void> => {
    const done = queue.current.then(async () => {
      const next = await api.current.setScenePrompting(held.current.id, change);
      // Held at once, so a switch made before the page has re-rendered still starts from this.
      held.current = next;
      changed.current(next);
    });
    queue.current = done.catch(() => undefined);
    return done;
  };

  return {
    library,
    reload: () => { setLibrary({ state: "loading" }); void load(); },
    save: async (guide) => {
      const saved = await api.current.saveGuide(guide);
      await load();
      return saved;
    },
    remove: async (id) => {
      await api.current.deleteGuide(id);
      await load();
    },
    setGuide: (id, on) => {
      const next = withGuide(asked.current ?? held.current.prompting?.guides ?? [], id, on);
      asked.current = next;
      waiting.current++;
      return write({ guides: next }).finally(() => { if (--waiting.current === 0) asked.current = null; });
    },
    patch: write,
  };
}
