/**
 * What every Compendium row reads and the one way it writes: the scene's chat, the resolved settings (defaults filled in on read, nothing written to show them) and `set`, the Settings tab's own writer
 * (`useSceneCompendium.patch`, one patch after the one before it) with its refusal said on the status line in the Settings tab's words.
 */
import type { AppContext } from "../../../../../app-contract";
import { toErrorMessage } from "../../../../../_shared/error-message";
import type { Chat, ChatCompendiumPatch } from "../../../../../../stage/contracts/chat-store";
import { useSceneCompendium, type SceneCompendium } from "../../../use-scene-compendium";
import { onChatOf, type WingArgs } from "../../wing-props";

export interface CompendiumEnv {
  ctx: AppContext;
  chat: Chat;
  compendium: SceneCompendium;
  /** Saves a change; a refusal is said in the status line, never thrown into the page. */
  set(change: ChatCompendiumPatch): Promise<void>;
}

export function useCompendiumSet(a: WingArgs): CompendiumEnv {
  const { ctx, scene } = a;
  const compendium = useSceneCompendium(ctx, scene.chat, onChatOf(a));
  const set = (change: ChatCompendiumPatch): Promise<void> =>
    compendium.patch(change).catch((e: unknown) => ctx.setStatus(`could not save the Compendium settings: ${toErrorMessage(e, "the scene refused it")}`));
  return { ctx, chat: scene.chat, compendium, set };
}
