/**
 * The scene scope's Overview page (wireframe SCOPES.scene, sover): the scene's title (`api.renameScene`, the writer the Scenes list uses), who you play (a select that confirms the cast, persona-rows.tsx, and a drill row to the Persona program) and the backdrop
 * (picked in the Control Panel layer, where its picker lives); Fan Favorite and the story folder (overview-rows.tsx) and, until the first send, the opening message. "Move scene to trash" is not drawn: the trash flow ends by leaving the page, which the settings layer cannot do.
 */
import type { JSX } from "react";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { DrillRow } from "../../frames/settings-rows";
import type { SettingsCategory } from "../../frames/settings-window";
import { onChatOf, type WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { FavoriteRow, FolderRow, OpeningRows } from "./overview-rows";
import { PlayingAs } from "./persona-rows";
import { SavedText } from "./saved";

function SceneRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { ctx, scene } = a;
  const chat = scene.chat;
  const onChat = onChatOf(a);
  const rename = async (title: string): Promise<void> => {
    if (title.trim() === "") return;
    try { onChat(await ctx.api.renameScene(chat.id, title.trim())); } catch (e) { ctx.setStatus(`could not rename the scene: ${toErrorMessage(e)}`); }
  };
  return (
    <>
      <SavedText label="Title" description="The name this scene has in your list." rows={1} saved={chat.title ?? a.name} write={rename} />
      <FavoriteRow a={a} />
      <FolderRow a={a} />
      <PlayingAs a={a} open={open} />
      <DrillRow label="Backdrop" description="The picture behind this scene's messages." value={chat.backdrop ? "Picked" : "None"} onOpen={() => open("display")} />
    </>
  );
}

export function overviewCategory(a: WingArgs, open: OpenProgram): SettingsCategory {
  const { scene } = a;
  const title = scene.chat.title ?? a.name;
  const hero: JSX.Element = <><h2 className="msn-st-h1">{title}</h2><p className="msn-st-secd">With {a.name}. {scene.messageCount} messages.</p></>;
  return { id: "overview", label: "Overview", icon: "lucide:layout-dashboard", hero, sections: [
    { id: "scene", title: "Scene", body: <SceneRows a={a} open={open} /> },
    ...(scene.messages.length === 0 ? [{ id: "opening", title: "Opening message", description: "How this scene begins, until you send the first message.", body: <OpeningRows a={a} /> }] : []),
  ] };
}
