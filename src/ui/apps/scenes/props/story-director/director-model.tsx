/**
 * The Director's model and how it is told what to do (RoleCall's Story Director Model selector, MiniModelSelector.tsx, and StoryDirectorToolModeSelector.tsx): the picker is the AI wing's own
 * (booth-model-picker.tsx), so a model is chosen one way everywhere; unset, the narrator's model answers. Under it RoleCall's amber line when the model reports no tool support, a Reasoning
 * choice ("Auto follows the model default"), and the command mode: "Tool call" or "Tagged", with the capability badge ("Native tools available", "Tagged recommended", "Tool support unknown").
 * The model row is a protected control (director-model): it sits in the protected layer, so no theme or mod can restyle or hide it, because it chooses where the chat is sent.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat, ChatReasoningEffort } from "../../../../../stage/contracts/chat-store";
import type { DirectorCommandMode, DirectorSettingsPatch } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { Ic, type IconName } from "../../../../_shared/ic";
import { Button, Card, Segmented } from "../../../../components/button";
import { protect } from "../../../../_shared/protected-control";
import { BoothModelPicker } from "../../booth-model-picker";
import { useSceneModels } from "../../use-scene-models";

type Save = (patch: DirectorSettingsPatch) => Promise<string | null>;

export const EFFORTS: readonly { id: ChatReasoningEffort | null; label: string }[] = [
  { id: null, label: "Auto" }, { id: "none", label: "Off" }, { id: "minimal", label: "Minimal" }, { id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }, { id: "xhigh", label: "Max" },
];

export function DirectorModel({ ctx, chat, panel, save, label, description }: { ctx: AppContext; chat: Chat; panel: DirectorPanel; save: Save; label: string; description: string }): JSX.Element {
  const models = useSceneModels(ctx, chat, () => undefined);
  const own = panel.settings.model;
  return (
    <div {...protect("director-model", "ds-block")} data-part="props.story-director.model">
      <div className="ds-h">{label}</div>
      <BoothModelPicker current={own ?? chat.connection} models={models} onPick={(model) => void save({ model })} />
      <p className="ds-help">{own ? description : `${description} Unset: the Director uses the narrator's model.`}</p>
      {own && <div className="ds-quiet"><Button variant="quiet" size="sm" onClick={() => void save({ model: null, reasoning: null })}>Use the narrator&apos;s model</Button></div>}
      {panel.tools === "none" && <p className="ds-amber" role="status">This model reports no tool-calling support. The Story Director needs it and will fall back every turn.</p>}
    </div>
  );
}

export function DirectorReasoning({ panel, save }: { panel: DirectorPanel; save: Save }): JSX.Element {
  const now = panel.settings.reasoning ?? null;
  return (
    <div className="ds-box" data-part="props.story-director.reasoning">
      <div className="ds-h">Reasoning</div>
      <p className="ds-help">Auto follows the model default. Other choices request only levels this route reports supporting.</p>
      <Segmented size="sm" label="Reasoning effort" items={EFFORTS.map((e) => ({ value: e.label, label: e.label }))} value={EFFORTS.find((e) => e.id === now)?.label ?? ""}
        onChange={(label) => void save({ reasoning: EFFORTS.find((e) => e.label === label)?.id ?? null })} />
    </div>
  );
}

export const MODES: readonly { id: DirectorCommandMode; label: string; description: string; icon: IconName }[] = [
  { id: "tool-call", label: "Tool call", description: "Native provider function calls. Recommended for models with reliable tool support.", icon: "lucide:wrench" },
  { id: "tagged", label: "Tagged", description: "Validated text commands for providers or models without native function calling.", icon: "lucide:braces" },
];
const CAPABILITY: Readonly<Record<DirectorPanel["tools"], { icon: IconName; label: string; description: string; tone: "ok" | "warn" | "info" }>> = {
  native: { icon: "lucide:circle-check", label: "Native tools available", description: "Tools are sent to this model. Tool call mode is available; if the server refuses them, pick Tagged.", tone: "ok" },
  none: { icon: "lucide:circle-alert", label: "Tagged recommended", description: "This model reports no native tool support. Select Tagged for reliable commands.", tone: "warn" },
  unknown: { icon: "lucide:circle-question-mark", label: "Tool support unknown", description: "Choose Tool call only when this provider/model supports native function calls.", tone: "info" },
};

export function DirectorCommandMode({ panel, save }: { panel: DirectorPanel; save: Save }): JSX.Element {
  const cap = CAPABILITY[panel.tools];
  return (
    <div className="ds-block" data-part="props.story-director.mode">
      <div className="ds-h">Story Director command mode</div>
      <p className="ds-help">Both modes use the same Director rules and state; only the command transport changes.</p>
      <div className="ds-modes" role="group" aria-label="Story Director command mode">
        {MODES.map((m) => (
          <Card key={m.id} kind="choice" heading={<><Ic name={m.icon} size={14} />{m.label}</>} subtitle={m.description} selected={panel.settings.commandMode === m.id}
            aria-pressed={panel.settings.commandMode === m.id} onClick={() => void save({ commandMode: m.id })} />
        ))}
      </div>
      <div className={`ds-cap ${cap.tone}`} title={cap.description}><Ic name={cap.icon} size={14} />{cap.label}</div>
    </div>
  );
}
