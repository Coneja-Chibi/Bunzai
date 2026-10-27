/**
 * Summary defaults a new scene starts with: the one `scenes.summaryDefaults` preference, written through the same couplings and checks the Settings app uses (settings/sections/memory.tsx).
 * Beyond the Settings app's eight it also holds the summary model, the messages included, reasoning, truncation and the prompt template: the store accepts them as defaults and `startScene`
 * copies them onto each new scene, and the rows read as the scene's own Memory page does.
 */
import { useState, type JSX } from "react";
import { autoPatch, hidePatch, intervalPatch, methodPatch, optionOf } from "../../../../../../core/summary/couplings";
import { DEFAULT_SUMMARY_PREF, SUMMARY_DEFAULTS, contextWindow, resolveSummary } from "../../../../../../core/summary/settings";
import type { BackfillMode } from "../../../../../../core/summary/prompts";
import type { SummarySettings, SummarySettingsPatch } from "../../../../../../stage/contracts/chat-store";
import { checkSummarySettings, mergeSummarySettings, summaryDefaultsOf } from "../../../../../../stage/store/summary-rules";
import { toErrorMessage } from "../../../../../_shared/error-message";
import type { AppContext } from "../../../../../app-contract";
import { methodLabel, promptVariables } from "../../../context/memory-core";
import { useSceneModels } from "../../../use-scene-models";
import { ActionRow, NumberRow, SegmentedRow, ToggleRow } from "../../frames/settings-rows";
import { ModelSelect } from "../scene/model-select";
import { SavedText } from "../scene/saved";

export function MemoryDefaultRows({ ctx }: { ctx: AppContext }): JSX.Element {
  const [saved, setSaved] = useState<SummarySettings | undefined>(() => (summaryDefaultsOf(ctx.prefs.get(DEFAULT_SUMMARY_PREF)) ?? undefined) as SummarySettings | undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const r = resolveSummary(saved);
  const put = (patch: SummarySettingsPatch): void => {
    try {
      const next = mergeSummarySettings(saved, checkSummarySettings(patch));
      ctx.prefs.set(DEFAULT_SUMMARY_PREF, next ?? null);
      setSaved(next);
      setProblem(undefined);
    } catch (e) { setProblem(toErrorMessage(e, "That value could not be saved.")); }
  };
  const models = useSceneModels(ctx, null, () => undefined);
  const option = optionOf(r);
  const kept =r.keepRecent ?? contextWindow(r) ?? SUMMARY_DEFAULTS.keepRecent;
  return (
    <div data-part="scene.messenger.settings.rows">
      {problem && <p role="alert" className="msn-st-secd">{problem}</p>}
      <ToggleRow label="Automatic summaries" description={`Create a summary on its own. Turning it on summarizes every ${SUMMARY_DEFAULTS.enabledInterval} messages.`}
        on={r.auto && (r.method === "pair" || r.interval > 0)} onChange={(on) => put(autoPatch(r, on))} />
      {r.method !== "pair" && <NumberRow label="Summarize every" description="Messages between automatic recaps. Zero turns them off." value={r.interval} min={0} onChange={(n) => put(intervalPatch(n))} />}
      <ToggleRow label="Include saved summary in AI context" description="Send the saved summary to the model with each reply." on={r.include} onChange={(on) => put({ include: on })} />
      <ToggleRow label="Hide messages already covered" description="Covered messages leave future prompts but stay in the scene. Needs the summary to be sent." on={r.hideOld && r.include}
        onChange={(on) => { if (r.include && on !== r.hideOld) put(hidePatch(r)); }} />
      {r.hideOld && r.include && <NumberRow label="Keep recent messages visible to AI" description="The newest messages kept word for word beside the summary." value={kept} min={1} onChange={(n) => put({ keepRecent: n > 0 ? n : null })} />}
      <SegmentedRow<BackfillMode> label="Summary method" description="Rolling recap rewrites one block, Growing timeline extends it, Every exchange adds a line after each reply."
        value={optionOf(r)} options={[{ value: "replace", label: "Rolling recap" }, { value: "additive", label: "Growing timeline" }, { value: "pair", label: "Every exchange" }]} onChange={(v) => put(methodPatch(r, v))} />
      <NumberRow label="Temperature" description="Lower values make recaps steadier; higher values allow looser wording." value={r.temperature} min={0} max={1} step={0.1} onChange={(n) => put({ temperature: Math.min(1, Math.max(0, n)) })} />
      <NumberRow label="Max output tokens" description="The most a summary may use." value={r.maxTokens} min={1} onChange={(n) => put({ maxTokens: n > 0 ? n : null })} />
      <ModelSelect label="Summary model" description="Uses each scene's own model unless you choose another." models={models} current={r.model} none="Same as the scene" onPick={(model) => put({ model })} />
      {option !== "pair" && <NumberRow label="Messages included" description="Messages in each summary. 0 matches the cadence, or sends all of them." value={r.window ?? 0} min={0} onChange={(n) => put({ window: n > 0 ? n : null })} />}
      <ToggleRow label="Enable reasoning" description="Low reasoning effort where the model supports it; it shares the token budget above." on={r.reasoning} onChange={(on) => put({ reasoning: on })} />
      <ToggleRow label="Truncate messages" description={`Cut each source message to ${String(SUMMARY_DEFAULTS.sourceLimit)} characters first.`} on={r.truncate} onChange={(on) => put({ truncate: on })} />
      <SavedText label="Prompt template" description={`What the summary model receives. Variables: ${promptVariables(option).join(", ")}. Blank uses the built-in prompt for ${methodLabel(option)}.`} rows={6} saved={r.prompt ?? ""}
        write={(text) => put({ prompt: text.trim() === "" ? null : text })} />
      <ActionRow label="Built-in defaults" description="Forget these choices; scenes started from now on use the built-in ones." action="Reset" onAction={() => { ctx.prefs.set(DEFAULT_SUMMARY_PREF, null); setSaved(undefined); }} />
    </div>
  );
}
