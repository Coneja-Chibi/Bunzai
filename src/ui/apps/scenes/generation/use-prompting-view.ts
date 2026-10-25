/**
 * The scene's own prompting settings (ChatStore rule 37) as the Generation tab shows and changes them: a
 * change shows at once and is saved through `setScenePrompting`, which merges each patch, so Reasoning Effort,
 * Start Reply With and Catch thinking never overwrite one another or the guides and note the Prompting wing
 * keeps beside them. Writes go one after another; a failed one is put back and said in the status line.
 */
import { useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { Chat, ChatPrompting, ChatPromptingPatch } from "../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../_shared/error-message";

export interface PromptingView {
  /** The settings as shown: the store's, with any change still being saved on top. */
  view: ChatPrompting;
  write(patch: ChatPromptingPatch, what: string): void;
}

export function usePromptingView(ctx: AppContext, chat: Chat, onChat: (chat: Chat) => void): PromptingView {
  const [asked, setAsked] = useState<ChatPromptingPatch>({});
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const status = useRef(ctx.setStatus);
  status.current = ctx.setStatus;
  const changed = useRef(onChat);
  changed.current = onChat;
  const chatId = useRef(chat.id);
  chatId.current = chat.id;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const view: Record<string, unknown> = { ...chat.prompting };
  for (const [key, value] of Object.entries(asked)) if (value === null) delete view[key]; else if (value !== undefined) view[key] = value;
  const settle = (patch: ChatPromptingPatch): void => setAsked((now) => {
    const rest: Record<string, unknown> = { ...now };
    for (const key of Object.keys(patch)) if (rest[key] === (patch as Record<string, unknown>)[key]) delete rest[key];
    return rest as ChatPromptingPatch;
  });
  return {
    view: view as ChatPrompting,
    write(patch, what) {
      setAsked((now) => ({ ...now, ...patch }));
      queue.current = queue.current.then(async () => {
        try {
          changed.current(await api.current.setScenePrompting(chatId.current, patch));
        } catch (e) {
          status.current(`${what} could not be saved: ${toErrorMessage(e)}`);
        }
        settle(patch);
      });
    },
  };
}
