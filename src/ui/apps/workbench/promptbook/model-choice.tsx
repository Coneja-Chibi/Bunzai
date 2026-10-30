/** Agent and phase model overrides use the scene's connection discovery and shared picker. */
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { ChatConnection } from "../../../../stage/contracts/chat-store";
import { useSceneModels } from "../../scenes/use-scene-models";
import { BoothModelPicker } from "../../scenes/booth-model-picker";
export function ModelChoice({ ctx, value, onChange }: { ctx: AppContext; value: ChatConnection | undefined; onChange(c: ChatConnection): void }): JSX.Element {
  const models = useSceneModels(ctx, null, () => undefined);
  return <BoothModelPicker current={value} models={models} onPick={onChange} />;
}
