/**
 * The scene's switch for change visuals (wireframe premiere/scene-pieces.html, 3e; option D): "Show what each reply changed" turns every tracker change shown under a reply on or off. On is the
 * default and is stored as nothing; only off is kept (`ChatPrompting.trackerChanges`, written through the scene's own prompting writer). How a tracker's changes look is the tracker's own setting
 * in the Workbench, so this row has no style choice.
 */
import type { JSX } from "react";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { onChatOf, type WingArgs } from "../../wing-props";
import { SavedToggle } from "./saved";

export function ChangesRow({ a }: { a: WingArgs }): JSX.Element {
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  return (
    <SavedToggle label="Show what each reply changed" description="Tracker changes appear under the reply that made them." saved={chat.prompting?.trackerChanges !== false}
      write={async (on) => { try { onChat(await a.ctx.api.setScenePrompting(chat.id, { trackerChanges: on })); } catch (e) { a.ctx.setStatus(`could not change what replies show: ${toErrorMessage(e)}`); } }} />
  );
}
