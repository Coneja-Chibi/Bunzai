/**
 * The Stage wing's Backdrop row (approved wireframe design/wireframes/backdrops/index.html, screen 1): the picked
 * picture's thumbnail and Change, or the plain words for none, gone and unreadable. RoleCall keeps its background
 * picker in the Stage settings panel's "The Stage" act (StageSettingsPanel.tsx:2116-2136), so this is where it lives
 * here too. The pick is the scene's own (ChatStore rule 36) and is saved the moment it is made.
 */
import { useState, type CSSProperties, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { toErrorMessage } from "../../_shared/error-message";
import type { Chat, ChatBackdrop } from "../../../stage/contracts/chat-store";
import { Button } from "../../components/button";
import { itemOf } from "./scene-backdrop-core";
import { BackdropThumb } from "./scene-backdrop-layer";
import { BackdropPicker } from "./scene-backdrop-picker";
import { useBackdropPack } from "./use-backdrop-pack";


export function BackdropRow({ ctx, chat, cardPinned, onChat }: { ctx: AppContext; chat: Chat; cardPinned?: boolean; onChat(chat: Chat): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const loaded = useBackdropPack(ctx, chat.backdrop?.pack);
  const item = chat.backdrop && loaded.state === "ready" ? itemOf(loaded.pack, chat.backdrop) : null;
  const gone = chat.backdrop !== undefined && (loaded.state === "gone" || (loaded.state === "ready" && item === null));
  const pick = async (backdrop: ChatBackdrop | null): Promise<void> => {
    setProblem(null);
    try {
      onChat(await ctx.api.setSceneBackdrop(chat.id, backdrop));
    } catch (e) {
      setProblem(`Could not change the backdrop: ${toErrorMessage(e)}`);
    }
  };
  const hint = gone ? "This scene's backdrop is no longer in your collection, so the scene shows the theme's own look."
    : loaded.state === "failed" ? "This backdrop could not be read right now."
    : chat.backdrop ? `The picture behind the messages${item ? `: ${item.label}.` : "."} Only this scene changes.`
    : cardPinned ? "The character's own background shows until you pick one here. Only this scene changes."
    : "The picture behind the messages. Only this scene changes. None keeps the theme's own look.";
  return (
    <>
      <div className="prop-row" style={{ "--tone": "var(--stage-macro)" } as CSSProperties} data-part="scene.backdrop.row">
        <span className="prop-ic"><Ic name="lucide:image" size={20} /></span>
        <div><b>Backdrop</b><small>{problem ?? hint}</small></div>
        <div className="bd-act">
          {item && <BackdropThumb refValue={item.ref} {...(item.mime ? { mime: item.mime } : {})} className="bd-thumb" />}
          <Button size="sm" onClick={() => setOpen(true)}>{chat.backdrop ? "Change" : "Pick"}</Button>
        </div>
      </div>
      {open && <BackdropPicker ctx={ctx} backdrop={chat.backdrop} onPick={pick} onClose={() => setOpen(false)} />}
    </>
  );
}
