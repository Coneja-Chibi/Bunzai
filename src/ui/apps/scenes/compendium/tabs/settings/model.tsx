/**
 * "Model and language" without the language (RoleCall `CompendiumModelSection`, `CompendiumSettings.tsx:1731-1856`): the model the Compendium's
 * passes use. The list and the picker are the AI wing's and the Control Booth's own (`use-scene-models.ts`, `booth-model-picker.tsx`); unset, the
 * scene's own model answers (RoleCall says "Inherit (Story Director)", 04b F16, and keeps a second copy in browser storage, which is not ported).
 * Output language is drawn with the filing pass that reads it.
 */
import type { JSX } from "react";
import { BoothModelPicker } from "../../../booth-model-picker";
import { SettingsField, SettingsSection } from "./parts";
import type { SectionProps } from "./deps";

export function ModelSection({ chat, compendium, models, set }: SectionProps): JSX.Element {
  const chosen = compendium.saved?.model;
  return (
    <SettingsSection id="model" title="Model" blurb="Choose the model Compendium uses to pick what the narrator should see.">
      <SettingsField label={chosen ? "Compendium Model" : "Compendium Model - uses this scene's model"} hint="AI model for compendium retrieval. Leave it unset to use this scene's own model.">
        <BoothModelPicker current={chosen ?? chat.connection} models={models} onPick={(model) => void set({ model })} />
        {chosen && <button type="button" className="cps-quiet" onClick={() => void set({ model: null })}>Use this scene&apos;s model</button>}
      </SettingsField>
    </SettingsSection>
  );
}
