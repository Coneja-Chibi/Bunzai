/**
 * The scene's Compendium choices (ChatStore rule 38), written in one place: the Settings tab and the shell's access
 * chip both go through `patch`. Reading is pure (`resolveCompendium` fills the defaults, nothing is written to show
 * them); a write is one patch, sent after the one before it so a quick second change is never overtaken by a slow
 * first, and the store's answer is what the page then shows.
 */
import { useRef } from "react";
import type { AppContext } from "../../app-contract";
import { resolveCompendium, type ResolvedCompendium } from "../../../core/compendium/defaults";
import type { Chat, ChatCompendiumPatch } from "../../../stage/contracts/chat-store";

export interface SceneCompendium {
  saved: Chat["compendium"];
  resolved: ResolvedCompendium;
  /** Saves a change and rejects with the reason when the store refused it. */
  patch(change: ChatCompendiumPatch): Promise<void>;
}

export function useSceneCompendium(ctx: AppContext, chat: Chat, onChanged: (chat: Chat) => void): SceneCompendium {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const id = chat.id;
  return {
    saved: chat.compendium,
    resolved: resolveCompendium(chat.compendium),
    patch: (change) => {
      const done = queue.current.then(async () => changed.current(await api.current.setSceneCompendium(id, change)));
      queue.current = done.catch(() => undefined);
      return done;
    },
  };
}
