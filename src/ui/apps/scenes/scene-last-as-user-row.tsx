/**
 * The Last Message as User switch (RoleCall's Control Booth "Runtime Setup" row, QuickPlayPanel.tsx:2173-2199):
 * re-tags the request's final message as a user turn for models that reject an assistant prefill. The scene's
 * own setting (ChatStore rule 37, `prompting.lastAsUser`); the Booth mounts this row, in the Props wing's
 * row grammar. Optimistic, and put back with a status line when the write fails.
 */
import { useState, type CSSProperties, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../_shared/error-message";
import { Ic } from "../../_shared/ic";
import { Toggle } from "../../components/button";

/** Switches Last Message as User on or off for a scene; answers the saved scene. */
export const setLastAsUser = (ctx: AppContext, chatId: string, on: boolean): Promise<Chat> => ctx.api.setScenePrompting(chatId, { lastAsUser: on });

export function LastAsUserRow({ ctx, chat, onChanged }: { ctx: AppContext; chat: Chat; onChanged(chat: Chat): void }): JSX.Element {
  const saved = chat.prompting?.lastAsUser === true;
  const [asked, setAsked] = useState<boolean | null>(null);
  const on = asked ?? saved;
  const flip = async (): Promise<void> => {
    setAsked(!on);
    try {
      onChanged(await setLastAsUser(ctx, chat.id, !on));
    } catch (e) {
      ctx.setStatus(`Last Message as User could not be saved: ${toErrorMessage(e)}`);
    }
    setAsked(null);
  };
  return (
    <div className="prop-row" style={{ "--tone": "var(--stage-ok)" } as CSSProperties}>
      <span className="prop-ic"><Ic name="lucide:user-round-check" size={20} /></span>
      <div><b>Last Message as User</b><small>Re-tag the final outbound message as user for models that reject assistant prefills.</small></div>
      <Toggle size="sm" tone="var(--tone)" on={on} aria-label={`${on ? "Turn off" : "Turn on"} last message as user`} onChange={() => void flip()} />
    </div>
  );
}
