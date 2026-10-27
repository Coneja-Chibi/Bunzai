/**
 * The Story Director's model as a select row (Full Chat: props/story-director/director-model.tsx `DirectorModel`): the models are the AI wing's own list, unset means the narrator's model answers, and choosing the
 * narrator's model again clears the Director's reasoning level with it, as the "Use the narrator's model" button does. The row chooses where the chat is sent, so it sits in the protected layer, as it does in Full Chat.
 */
import type { JSX } from "react";
import type { DirectorSettingsPatch } from "../../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../../studio/scene-director-edit";
import { protect } from "../../../../../_shared/protected-control";
import { useSceneModels } from "../../../use-scene-models";
import type { WingArgs } from "../../wing-props";
import { ModelSelect } from "./model-select";

export function DirectorModelRow({ a, settings, save }: { a: WingArgs; settings: DirectorPanel["settings"]; save(patch: DirectorSettingsPatch): Promise<void> }): JSX.Element {
  const models = useSceneModels(a.ctx, a.scene.chat, () => undefined);
  return (
    <div {...protect("director-model")}>
      <ModelSelect label="Story Director model" description="Unset, the Director uses the narrator's model." models={models} current={settings.model} none="Narrator's model"
        onPick={(model) => void save(model ? { model } : { model: null, reasoning: null })} />
    </div>
  );
}
