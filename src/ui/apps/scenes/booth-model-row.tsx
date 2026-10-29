/**
 * The Control Booth's Narrator Model row (RoleCall's QuickPlayPanel "Narrator Model", :1709-1904): the
 * model that writes the scene, with a dropdown to change it. The list is the AI wing's own (use-scene-models.ts:
 * Kit's connections and their discovered models), grouped by connection with a Provider filter and a
 * search; a pick is the scene's pick (setSceneConnection, ChatStore rule 18). RoleCall's billing badges
 * ("Not In Your Plan", "In-house") have no Bunzai counterpart; a connection scenes cannot use shows
 * "Setup Required" and its reason, and cannot be picked.
 */
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { BoothFallbackRow } from "./booth-fallback-row";
import { BoothModelPicker } from "./booth-model-picker";
import type { SceneModels } from "./use-scene-models";

export function BoothModelRow({ ctx, chat, models }: { ctx: AppContext; chat: Chat; models: SceneModels }): JSX.Element {
  return (
    <section className="bth-sec" data-part="scene.booth.model">
      <h3>Narrator Model</h3>
      <BoothModelPicker current={chat.connection} models={models} onPick={models.pick} />
      <BoothFallbackRow ctx={ctx} models={models} />
    </section>
  );
}
