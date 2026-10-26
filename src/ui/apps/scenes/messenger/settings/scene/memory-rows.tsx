/**
 * The three summary sections of the scene scope's Memory page (wireframe: Summary, Summary controls, Advanced), each value a row bound to `useSummary`, the one reader and writer the Memory tab uses, with the same couplings
 * (core/summary/couplings.ts) and the same clamps. Each section reads the summary for itself and writes only the keys it changed, so three sections never overwrite one another. "Summarize now" runs the automatic step once;
 * Backfill history rebuilds the whole text.
 */
import type { JSX, ReactNode } from "react";
import { autoPatch, hidePatch, intervalPatch, methodPatch, optionOf } from "../../../../../../core/summary/couplings";
import { SUMMARY_DEFAULTS, contextWindow, resolveSummary, summaryWindow, type ResolvedSummary } from "../../../../../../core/summary/settings";
import type { ChatConnection } from "../../../../../../stage/contracts/chat-store";
import { backfillLabel, methodLabel, nowLabel, promptVariables } from "../../../context/memory-core";
import { useSummary, type SummaryView } from "../../../context/use-summary";
import { modelChoices, keyOf, useSceneModels, type SceneModels } from "../../../use-scene-models";
import { ActionRow, RadioCards, SelectRow } from "../../frames/settings-rows";
import { CheckedText, SaveText } from "./drafts";
import { chatOf, takeChat, type SceneEnv } from "./env";
import { SavedNumber, SavedSlider, SavedToggle } from "./saved";

type Ready = Extract<SummaryView["load"], { state: "ready" }>["s"];

/** The rows of one section while the summary is read; the words of the Memory tab while it is not. */
function Loaded({ view, children }: { view: SummaryView; children(s: Ready, r: ResolvedSummary): ReactNode }): JSX.Element {
  if (view.load.state === "loading") return <p className="msn-st-secd" role="status">Loading the summary...</p>;
  if (view.load.state === "failed") return <p className="msn-st-secd" role="alert">{view.load.why}</p>;
  const { s } = view.load;
  return <>{children(s, resolveSummary(s.settings))}</>;
}

/** The include, hide and keep switches and the text itself. */
export function SummaryBody({ env }: { env: SceneEnv }): JSX.Element {
  const view = useSummary(env.a.ctx, chatOf(env));
  return (
    <div data-part="scene.messenger.settings.memory.summary">
      <Loaded view={view}>{(s, r) => (
        <>
          <SavedToggle label="Include saved summary in AI context" description="Send it with every turn. Off keeps it stored without sending it." saved={r.include} write={(include) => view.patch({ include })} />
          {r.include && <SavedToggle label="Hide messages already covered by the summary" description="They stay in the chat but stop going to the model. Nothing is deleted." saved={r.hideOld} write={() => view.patch(hidePatch(r))} />}
          {r.include && r.hideOld && (
            <SavedNumber label="Keep recent messages visible to AI" description="The newest messages sent as written beside the summary." saved={r.keepRecent ?? contextWindow(r) ?? SUMMARY_DEFAULTS.keepRecent} min={1} max={100_000} step={1}
              write={(n) => view.patch({ keepRecent: n > 0 ? n : null })} />
          )}
          <SaveText label="Current summary" description={s.running ? "Generating a summary..." : "Edit it by hand and it is kept as written."} saved={s.text ?? ""} rows={6} action="Save"
            write={async (text) => { const why = await view.save(text); if (why) env.a.ctx.setStatus(why); }} />
        </>
      )}</Loaded>
    </div>
  );
}

/** Every model Kit's connections list, as one choice each; a connection scenes cannot use offers nothing. */

/** How summaries run: automatic or manual, how often, with which model and window, and the manual run. */
export function ControlsBody({ env }: { env: SceneEnv }): JSX.Element {
  const chat = chatOf(env);
  const view = useSummary(env.a.ctx, chat);
  const models = useSceneModels(env.a.ctx, chat, takeChat(env));
  const choices = modelChoices(models);
  return (
    <div data-part="scene.messenger.settings.memory.controls">
      <Loaded view={view}>{(s, r) => {
        const option = optionOf(r);
        const current = r.model ? keyOf(r.model) : "";
        const options = [{ value: "", label: "Same as the scene" }, ...(current && !choices.some((c) => c.value === current) ? [{ value: current, label: current.replace("|", ": ") }] : []), ...choices.map((c) => ({ value: c.value, label: c.label }))];
        const failure = view.runError ?? s.error;
        return (
          <>
            <RadioCards label="Run mode" value={r.auto ? "auto" : "manual"} options={[{ value: "auto", label: "Automatic", description: "Write a summary every few messages." }, { value: "manual", label: "Manual", description: "Only when you run a backfill." }]}
              onChange={(mode) => void view.patch(autoPatch(r, mode === "auto"))} />
            {option !== "pair" && <SavedNumber label="Summarize every" description="Messages between summaries. 0 turns automatic summaries off." saved={r.interval} min={0} max={100_000} step={1} write={(n) => view.patch(intervalPatch(n))} />}
            <SelectRow label="Summary model" description="Uses this scene's model unless you choose another." value={current} options={options}
              onChange={(key) => void view.patch({ model: key ? (choices.find((c) => c.value === key)?.conn ?? null) : null })} />
            {option !== "pair" && (
              <SavedNumber label="Messages included" description={`Messages in each summary. 0 matches the cadence${r.interval > 0 ? ` (${r.interval})` : ", or sends all of them"}. Now: ${summaryWindow(r) ?? "all"}.`}
                saved={r.window ?? 0} min={0} max={100_000} step={1} write={(n) => view.patch({ window: n > 0 ? n : null })} />
            )}
            {failure && <p className="msn-st-secd" role="alert">Last summary run failed: {failure}</p>}
            <ActionRow label="Summarize now" description={nowLabel(r, Boolean(s.text))} {...(s.running ? { value: "Running" } : {})} action="Summarize" variant="primary"
              onAction={() => { if (!s.running && !view.busy) void view.summarizeNow(); }} />
            <ActionRow label="Backfill history" description={`This run: ${backfillLabel(option)}. The whole history is loaded and split for the model.`} {...(s.running ? { value: "Running" } : {})} action="Backfill"
              onAction={() => { if (!s.running && !view.busy) void view.backfill(); }} />
          </>
        );
      }}</Loaded>
    </div>
  );
}

const METHODS = [{ value: "replace", label: "Rolling recap" }, { value: "additive", label: "Growing timeline" }, { value: "pair", label: "Every exchange" }] as const;

/** The summary model's own settings: method, reasoning, limits and the prompt template. */
export function AdvancedBody({ env }: { env: SceneEnv }): JSX.Element {
  const view = useSummary(env.a.ctx, chatOf(env));
  return (
    <div data-part="scene.messenger.settings.memory.advanced">
      <Loaded view={view}>{(_s, r) => {
        const option = optionOf(r);
        return (
          <>
            <SelectRow label="Summary method" description={option === "pair" ? "Appends one line per exchange." : option === "additive" ? "Adds the newest window to the existing summary." : "Rewrites the summary into a compact recap."} value={option} options={METHODS}
              onChange={(v) => void view.patch(methodPatch(r, v as typeof option))} />
            <SavedSlider label="Temperature" description="Lower values make recaps steadier; higher values allow looser wording." saved={r.temperature} min={0} max={1} step={0.05} write={(temperature) => view.patch({ temperature })} />
            <SavedNumber label="Max output tokens" description="The largest size of each generated summary." saved={r.maxTokens} min={1} max={100_000} step={1} write={(maxTokens) => view.patch({ maxTokens })} />
            <SavedToggle label="Enable reasoning" description="Low reasoning effort where the model supports it; it shares the token budget above." saved={r.reasoning} write={(reasoning) => view.patch({ reasoning })} />
            <SavedToggle label="Truncate messages" description={`Cut each source message to ${SUMMARY_DEFAULTS.sourceLimit} characters first.`} saved={r.truncate} write={(truncate) => view.patch({ truncate })} />
            <CheckedText label="Prompt template" description={`What the summary model receives. Variables: ${promptVariables(option).join(", ")}. Blank uses the built-in prompt for ${methodLabel(option)}.`} saved={r.prompt ?? ""} rows={6} delay={1000}
              write={(text) => view.patch({ prompt: text.trim() === "" ? null : text })} />
            {r.prompt && <ActionRow label="Reset prompt" description="Go back to the built-in prompt." action="Reset" onAction={() => void view.patch({ prompt: null })} />}
          </>
        );
      }}</Loaded>
    </div>
  );
}
