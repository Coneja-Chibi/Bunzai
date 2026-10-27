/**
 * The scene scope's Control Booth page (wireframe SCOPES.scene, booth): the values the Booth hub keeps, as rows bound to the Booth's own writers. The narrator model is a select (model-select.tsx) with a deeper page of favorites; the preset and the
 * loadouts are tools (the prompt editor, the loadout dialogs), so they are drill rows to their programs; the fallback model is the per-user pref the Booth writes
 * (fallback-model.ts); the lorebook switches, the summary switches and the runtime setup are the same writers the Booth rows use.
 */
import { useReducer, useState, type JSX } from "react";
import { autoPatch } from "../../../../../../core/summary/couplings";
import { automationActive, resolveSummary } from "../../../../../../core/summary/settings";
import { TOOL_ROUNDS_DEFAULT, TOOL_ROUNDS_MAX, TOOL_ROUNDS_MIN } from "../../../../../../core/assembly/tool-rounds";
import type { ChatConnection } from "../../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../../app-contract";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { protect } from "../../../../../_shared/protected-control";
import { FALLBACK_KEY, readFallback } from "../../../fallback-model";
import { timingLabel } from "../../../context/memory-core";
import { useSummary } from "../../../context/use-summary";
import { presetTile } from "../../../scene-booth-wing";
import { setLastAsUser } from "../../../scene-last-as-user-row";
import { useBoothPreset } from "../../../use-booth-preset";
import { useSceneModels, type SceneModels } from "../../../use-scene-models";
import { DrillRow, SegmentedRow, ToggleRow } from "../../frames/settings-rows";
import { useSettingsNav, type SettingsCategory } from "../../frames/settings-window";
import { onChatOf, type WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { ModelSelect } from "./model-select";
import { MODELS_PAGE } from "./pages";
import { SavedNumber, SavedToggle } from "./saved";
import { LorebookRows } from "./world";

const SAY = "msn-st-secd";

/** Every model Kit's connections list, as one flat choice each. A connection scenes cannot use offers nothing. */

/** Fallback model: Off, or a model you pick. The per-user pref the Booth's row writes, so it applies to every scene. */
function FallbackRows({ ctx, models }: { ctx: AppContext; models: SceneModels }): JSX.Element {
  const [, again] = useReducer((n: number) => n + 1, 0);
  const [pending, setPending] = useState(false);
  const saved = readFallback(ctx.prefs.get(FALLBACK_KEY));
  const mode = saved.mode === "custom" || pending ? "custom" : "off";
  const set = (value: unknown): void => { ctx.prefs.set(FALLBACK_KEY, value); again(); };
  return (
    <>
      <SegmentedRow label="Fallback model" description="What answers when the scene's model fails. Applies to all your scenes." value={mode} options={[{ value: "off", label: "Off" }, { value: "custom", label: "Custom" }]}
        onChange={(next) => { if (next === "off") { setPending(false); set({ mode: "off" }); } else if (saved.mode !== "custom") setPending(true); }} />
      {mode === "custom" && (
        <ModelSelect label="Model used as the fallback" models={models} current={saved.mode === "custom" ? saved.connection : undefined} none="Pick a model"
          onPick={(connection) => { if (connection) { setPending(false); set({ mode: "custom", connection }); } }} />
      )}
    </>
  );
}

/** Chat summary switches (the Booth's row) and the way to the Memory program, where the text and method live. */
function SummaryRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const view = useSummary(a.ctx, a.scene.chat);
  if (view.load.state === "loading") return <p className={SAY} role="status">Loading the summary...</p>;
  if (view.load.state === "failed") return <p className={SAY} role="alert">{view.load.why}</p>;
  const r = resolveSummary(view.load.s.settings);
  return (
    <>
      <ToggleRow label="Automatic summaries" description="A new summary is written on its own." on={automationActive(r)} onChange={(on) => void view.patch(autoPatch(r, on))} />
      <ToggleRow label="Include saved summary in AI context" description="The AI receives the saved summary with each reply." on={r.include} onChange={(include) => void view.patch({ include })} />
      <DrillRow label="Summary" description="The text, the method and Backfill history." value={timingLabel(r)} onOpen={() => open("memory")} />
    </>
  );
}

function RightNow({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const nav = useSettingsNav();
  const { ctx, scene } = a;
  const chat = scene.chat;
  const models = useSceneModels(ctx, chat, onChatOf(a));
  const preset = useBoothPreset(ctx, chat.preset ?? null);
  return (
    <>
      <ModelSelect label="Narrator model" description="The model this scene writes with. Starred models come first." models={models} current={chat.connection} none="Pick a model" onPick={(model) => { if (model) models.pick(model); }} />
      <DrillRow label="Favorite models" description="Star the models you reach for most." value={models.favorites.length > 0 ? `${String(models.favorites.length)} starred` : undefined} onOpen={() => nav.open(MODELS_PAGE)} />
      <FallbackRows ctx={ctx} models={models} />
      <DrillRow label="Preset" description="How the prompt is built." value={presetTile(chat, preset)} onOpen={() => open("prompts")} />
    </>
  );
}

/** Narrator tool access, Max tool rounds (shown while access is on, clamped) and Last message as user: the scene's prompting settings (ChatStore rule 37). */
function Runtime({ a }: { a: WingArgs }): JSX.Element {
  const { ctx } = a;
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  const write = async (patch: { toolAccess?: boolean; toolRounds?: number; lastAsUser?: boolean }, what: string): Promise<void> => {
    try { onChat(patch.lastAsUser !== undefined ? await setLastAsUser(ctx, chat.id, patch.lastAsUser) : await ctx.api.setScenePrompting(chat.id, patch)); } catch (e) { ctx.setStatus(`${what} could not be saved: ${toErrorMessage(e)}`); }
  };
  const access = chat.prompting?.toolAccess === true;
  return (
    <>
      <div {...protect("narrator-tools")}>
        <SavedToggle label="Narrator tool access" description="Off means the writing model receives no tools. Director and Compendium helpers still work separately." saved={access} write={(on) => write({ toolAccess: on }, "Narrator Tool Access")} />
        {access && <SavedNumber label="Max tool rounds" description="Tool calls allowed before the model must answer." saved={chat.prompting?.toolRounds ?? TOOL_ROUNDS_DEFAULT} min={TOOL_ROUNDS_MIN} max={TOOL_ROUNDS_MAX} step={1} write={(n) => write({ toolRounds: n }, "Max tool rounds")} />}
      </div>
      <SavedToggle label="Last message as user" description="Re-tag the final outbound message as user for models that reject assistant prefills." saved={chat.prompting?.lastAsUser === true} write={(on) => write({ lastAsUser: on }, "Last Message as User")} />
    </>
  );
}

export function boothCategory(a: WingArgs, open: OpenProgram): SettingsCategory {
  return { id: "booth", label: "Control Booth", icon: "lucide:zap", sections: [
    { id: "right-now", title: "Right now", description: "The quick page for what you change most.", body: <RightNow a={a} open={open} /> },
    { id: "booth-lorebooks", title: "Lorebooks", description: "Switch a book on or off for this scene.", body: <LorebookRows a={a} open={open} /> },
    { id: "booth-summary", title: "Chat summary", body: <SummaryRows a={a} open={open} /> },
    { id: "runtime", title: "Runtime setup", body: <Runtime a={a} /> },
    { id: "loadouts", title: "Loadouts", description: "Models, preset, lorebooks and features saved together.", body: <DrillRow label="Loadouts" description="Save the current setup, load one, or undo a load." onOpen={() => open("quickplay")} /> },
  ] };
}
