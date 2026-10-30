/**
 * The settings under the Dramaturg's row (specs/stage/dramaturg.md, "Surface"): its model, with the AI wing's own picker (booth-model-picker.tsx)
 * and RoleCall's line that this is the one place a model different from the scene's is the point; Reasoning; Temperature. Unset, the scene's
 * own model answers. Every write is the scene's own setting (ChatStore rule 48) and comes back as the panel, so what is shown is what is saved.
 * The model row is a protected control (dramaturg-model): it chooses where the scene is sent, so no theme or mod may restyle or hide it.
 * Whether the Dramaturg is on is the row's switch; nothing here repeats it.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { DramaturgSettingsPatch } from "../../../../../stage/contracts/dramaturg-types";
import { DRAMATURG_DEFAULT_TEMPERATURE } from "../../../../../core/dramaturg/settings";
import { Button, Segmented } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { protect } from "../../../../_shared/protected-control";
import { BoothModelPicker } from "../../booth-model-picker";
import { EFFORTS } from "../story-director/director-model";
import { useSceneModels } from "../../use-scene-models";
import { loadDramaturg, saveDramaturgSettings, useDramaturg } from "./dramaturg-live";


export function DramaturgSettings({ ctx, chat }: { ctx: AppContext; chat: Chat }): JSX.Element {
  const live = useDramaturg(ctx.api, chat.id);
  const models = useSceneModels(ctx, chat, () => undefined);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const panel = live.panel;
  if (!panel) {
    return (
      <div className="ds" data-part="props.dramaturg.settings">
        {live.error ? <><p className="ds-err" role="alert">{live.error}</p><Button variant="quiet" size="sm" onClick={() => void loadDramaturg(ctx.api, chat.id)}>Try again</Button></> : <p className="ds-help" role="status">Loading...</p>}
      </div>
    );
  }
  const s = panel.thread.settings;
  const save = async (patch: DramaturgSettingsPatch): Promise<void> => { setError(await saveDramaturgSettings(ctx.api, chat.id, patch)); };
  const shownTemp = temp ?? String(s.temperature ?? DRAMATURG_DEFAULT_TEMPERATURE);
  const commitTemp = (): void => {
    if (temp === null) return;
    const n = Number(temp);
    if (temp.trim() === "") void save({ temperature: null }).then(() => setTemp(null));
    else if (Number.isFinite(n) && n >= 0 && n <= 2) void save({ temperature: n }).then(() => setTemp(null));
    else { setError("Temperature must be a number from 0 to 2."); setTemp(null); }
  };
  return (
    <div className="ds" data-part="props.dramaturg.settings">
      <div {...protect("dramaturg-model", "ds-block")} data-part="props.dramaturg.model">
        <div className="ds-h">Dramaturg Model</div>
        <BoothModelPicker current={s.model ?? chat.connection} models={models} onPick={(model) => void save({ model })} />
        <p className="ds-help">
          {s.model ? "The model that reads the scene with you." : "The model that reads the scene with you. Unset: the scene's own model answers."} This is the one place where a model different from the scene's is the point: the scene's is chosen for prose, the Dramaturg wants one that reasons.
        </p>
        {s.model && <Button variant="quiet" size="sm" onClick={() => void save({ model: null, reasoning: null })}>Use the scene&apos;s model</Button>}
        {panel.tools === "none" && <p className="ds-amber" role="status">This model takes no tools. The Dramaturg answers from what it is given each turn and names what it could not reach.</p>}
      </div>
      <div className="ds-box" data-part="props.dramaturg.reasoning">
        <div className="ds-h">Reasoning</div>
        <p className="ds-help">Auto follows the model default. Other choices request only levels this route reports supporting.</p>
        <Segmented size="sm" label="Reasoning effort" items={EFFORTS.map((e) => ({ value: e.label, label: e.label }))} value={EFFORTS.find((e) => e.id === (s.reasoning ?? null))?.label ?? "Auto"} onChange={(label) => void save({ reasoning: EFFORTS.find((e) => e.label === label)?.id ?? null })} />
      </div>
      <div className="ds-row" title="How freely the Dramaturg words its readings; the evidence rules hold at any value.">
        <label htmlFor={`dmg-temp-${chat.id}`}><Ic name="lucide:thermometer" size={12} />Temperature</label>
        <input id={`dmg-temp-${chat.id}`} type="number" min={0} max={2} step={0.05} value={shownTemp} onChange={(e) => setTemp(e.target.value)} onBlur={commitTemp} onKeyDown={(e) => { if (e.key === "Enter") commitTemp(); }} />
      </div>
      {error && <p className="ds-err" role="alert">{error}</p>}
    </div>
  );
}
