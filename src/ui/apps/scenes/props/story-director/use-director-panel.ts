/**
 * The Director panel's data (ChatStore rule 47 through `getSceneDirector`, `editSceneDirector`, `setSceneDirectorSettings`): read when the scene opens and again whenever the take, the reply
 * or a Director turn moves; an edit sends back the version the panel was showing, so an edit made against a story a turn has since moved is refused (409) and the panel reads again instead
 * of overwriting it. Answers arrive in order: a slower, older read never lands over a newer one. The person's edits go one at a time.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../../app-contract";
import { toErrorMessage } from "../../../../_shared/error-message";
import type { AsyncState } from "../../../../_shared/async-state";
import type { DirectorEdit, DirectorSettingsPatch } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import type { Chat, TrackerModule } from "../../../../../stage/contracts/chat-store";
import { useDirectorLive } from "./director-live";

export type DirectorLoad = AsyncState<{ panel: DirectorPanel }>;
export interface DirectorData {
  load: DirectorLoad;
  /** Runs one edit; resolves null when it landed, else `words` (RoleCall's own line for that edit). */
  edit(edit: DirectorEdit, words: string): Promise<string | null>;
  /** Changes the scene's Director settings; resolves null when it landed, else the words to show. */
  settings(patch: DirectorSettingsPatch): Promise<string | null>;
  /** Undoes the Story Director's update of one tracker made by reply `messageId`; resolves null when it landed, else `words`. */
  undoTracker(module: TrackerModule, messageId: string, words: string): Promise<string | null>;
  reload(): void;
}

export function useDirectorPanel(ctx: AppContext, chat: Pick<Chat, "id" | "updatedAt" | "activeBranchId">, at: string | null = null): DirectorData {
  const [load, setLoad] = useState<DirectorLoad>({ state: "loading" });
  const live = useDirectorLive(chat.id);
  const asked = useRef(0);
  const mounted = useRef(true);
  const shown = useRef<DirectorPanel | null>(null);
  const queue = useRef(Promise.resolve());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const land = (panel: DirectorPanel): void => { shown.current = panel; setLoad({ state: "ready", panel }); };
  const read = useCallback(async (): Promise<void> => {
    const mine = ++asked.current;
    try {
      const panel = await ctx.api.getSceneDirector(chat.id, at ? { at } : undefined);
      if (mounted.current && mine === asked.current) land(panel);
    } catch (e) {
      if (mounted.current && mine === asked.current) setLoad({ state: "failed", why: toErrorMessage(e, "the Story Director could not be read") });
    }
  }, [ctx.api, chat.id, at]);
  useEffect(() => { void read(); }, [read, chat.updatedAt, chat.activeBranchId, live.rev]);

  const run = (what: string, work: () => Promise<DirectorPanel>): Promise<string | null> => {
    const next = queue.current.then(async () => {
      try {
        const panel = await work();
        ++asked.current;
        if (mounted.current) land(panel);
        return null;
      } catch (e) {
        void read();
        return what;
      }
    });
    queue.current = next.then(() => undefined);
    return next;
  };
  return {
    load,
    reload: () => void read(),
    edit: (edit, words) => run(words, () => ctx.api.editSceneDirector(chat.id, edit, shown.current?.version ?? null)),
    undoTracker: (module, messageId, words) => run(words, () => ctx.api.undoSceneTrackerUpdate(chat.id, module, messageId)),
    settings: (patch) => run("Story Director could not be updated.", () => ctx.api.setSceneDirectorSettings(chat.id, patch)),
  };
}
