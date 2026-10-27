/**
 * The scene-level attributes the Overview page draws as rows beside the title: Fan Favorite (`api.setSceneFavorite`, the writer the Scenes list's menu calls), the story folder
 * (`api.setSceneFolder`, with the folders `api.listSceneFolders` reads, as "Move to folder" does) and, until the first send, which greeting opens the scene and its text. The pick is the
 * page's own state (`WingArgs.greeting`, read by the first send) and the text is kept on the scene through `api.editScene("opening")`, by the rule the transcript's greeting editor uses.
 */
import type { JSX } from "react";
import type { SceneFolder } from "../../../../../../stage/contracts/chat-store";
import { greetingsOf } from "../../../../../../studio/scenes";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { greetingText, openingAfterEdit } from "../../../use-greeting-draft";
import { SelectRow } from "../../frames/settings-rows";
import { onChatOf, type WingArgs } from "../../wing-props";
import { isList, useLoaded } from "../user/use-loaded";
import { SavedText, SavedToggle } from "./saved";

type Folders = (SceneFolder & { count: number })[];

/** The star on the scene: shown in the Scenes list's Fan Favorites shelf. */
export function FavoriteRow({ a }: { a: WingArgs }): JSX.Element {
  const { ctx } = a;
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  return (
    <SavedToggle label="Fan Favorite" description="Show this scene on the Fan Favorites shelf of your scenes." saved={chat.favoredAt !== undefined}
      write={async (on) => { try { onChat(await ctx.api.setSceneFavorite(chat.id, on)); } catch (e) { ctx.setStatus(`could not update Fan Favorites: ${toErrorMessage(e)}`); } }} />
  );
}

/** The story folder the scene sits in; "No folder" takes it out. */
export function FolderRow({ a }: { a: WingArgs }): JSX.Element | null {
  const { ctx } = a;
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  const folders = useLoaded(() => ctx.api.listSceneFolders(), isList<Folders[number]>).value;
  if (!folders || folders.length === 0) return null;
  const known = folders.some((f) => f.id === chat.folderId);
  return (
    <SelectRow label="Story folder" description="Where this scene is filed in your scenes list." value={known ? chat.folderId! : ""} options={[{ value: "", label: "No folder" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
      onChange={(id) => { void ctx.api.setSceneFolder(chat.id, id === "" ? null : id).then(onChat, (e: unknown) => ctx.setStatus(`could not move that scene: ${toErrorMessage(e)}`)); }} />
  );
}

/** Which greeting opens the scene and what it says. Only before the first send: after it the greeting is the scene's first message and is edited there. */
export function OpeningRows({ a }: { a: WingArgs }): JSX.Element | null {
  const { ctx, scene } = a;
  const greetings = greetingsOf(scene.snapshot.character);
  if (scene.messages.length > 0 || greetings.length === 0) return null;
  const pick = a.greeting;
  const index = Math.min(pick?.index ?? 0, greetings.length - 1);
  const saved = scene.chat.opening;
  const write = async (text: string): Promise<void> => {
    const next = openingAfterEdit(greetings, saved, index, text);
    if (!next || (next.opening === null && !saved)) return;
    try { a.replaceScene(await ctx.api.editScene("opening", { chatId: scene.chat.id, opening: next.opening })); } catch (e) { ctx.setStatus(`could not change the scene: ${toErrorMessage(e)}`); }
  };
  return (
    <>
      {pick && greetings.length > 1 && (
        <SelectRow label="Opening message" description="Which of the card's greetings starts this scene." value={String(index)} options={greetings.map((_, i) => ({ value: String(i), label: `Greeting ${String(i + 1)} of ${String(greetings.length)}` }))}
          onChange={(v) => pick.pick(Number(v))} />
      )}
      <SavedText key={index} label="Opening message text" description="The first message of the scene. An empty text is not saved; macros stay as written." rows={5} saved={greetingText(greetings, saved, index)} write={write} />
    </>
  );
}
