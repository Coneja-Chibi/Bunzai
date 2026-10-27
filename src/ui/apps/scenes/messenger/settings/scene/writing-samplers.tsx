/**
 * The Samplers section of the scene scope's Writing page: every value the Generation tab edits (core samplers, reasoning, start reply with, catch thinking, the parameter catalogue), as rows. One scene preset writer
 * (`useScenePresetOwn`) and one prompting writer (`usePromptingView`) serve the whole section, as they do in the Generation tab, so two edits can never overwrite each other. The values are the same ones the Preset tab and the
 * Control Booth write. A scene with no preset has nowhere to keep sampler values, so those rows give way to a link to the preset tool.
 */
import { useState, type JSX } from "react";
import type { PresetBody } from "../../../../../../entities/preset/schema";
import { BUILTIN_CAPTURE_OPTIONS, normalizeCapture, type CaptureMode } from "../../../../../../core/reasoning-capture";
import type { ChatPreset, ChatReasoningEffort } from "../../../../../../stage/contracts/chat-store";
import { paramById } from "../../../../../../stage/params";
import { CORE_FIELD, CORE_PARAMS, type CoreId } from "../../../../../../stage/params/core";
import { REASONING_EFFORT_OPTIONS } from "../../../../../../stage/params/reasoning";
import { captureWithMode } from "../../../generation/catch-thinking";
import { coreValue } from "../../../generation/generation-core";
import { ROLE_NAME } from "../../../generation/thinking-group";
import { usePromptingView, type PromptingView } from "../../../generation/use-prompting-view";
import { useGenerationProvider } from "../../../generation-params-groups";
import { MAX_MESSAGES, MERGE, SLIDERS } from "../../../scene-preset-parts";
import { useBoothPreset } from "../../../use-booth-preset";
import { useScenePresetOwn, type ScenePresetOwn } from "../../../use-scene-preset-own";
import { ActionRow, DrillRow, SegmentedRow, SelectRow, SliderRow, ToggleRow } from "../../frames/settings-rows";
import { CheckedText } from "./drafts";
import { chatOf, takeChat, type SceneEnv } from "./env";
import { SavedNumber } from "./saved";
import { CustomTagRows } from "./writing-tags";
import { ParamRows, firstSentence } from "./writing-params";

const EFFORTS = REASONING_EFFORT_OPTIONS.map((o) => ({ value: o.value as string, label: o.label.split(" - ")[0]!, description: o.label }));
const ROLES = (["assistant", "user", "system"] as const).map((r) => ({ value: r, label: ROLE_NAME[r] }));
const MODES = [{ value: "auto", label: "Auto" }, { value: "only", label: "Only these" }, { value: "off", label: "Off" }] as const;
type ContextKey = "contextMode" | "maxContext" | "maxMessages" | "promptPostProcessing";

/** Temperature, Top P, Top K and the reply length (the Generation tab's Core), then the context window and the post-processing the Preset tab's bar also holds. */
function CoreRows({ own, body }: { own: ScenePresetOwn; body: PresetBody }): JSX.Element {
  const scene = own.own!;
  const at = <K extends ContextKey>(k: K): ChatPreset["samplers"][K] => (scene.samplers[k] ?? body.samplers?.[k]) as ChatPreset["samplers"][K];
  const set = <K extends ContextKey>(key: K, value: ChatPreset["samplers"][K]): void => own.setSamplerValue(body.samplers, key, value);
  const mode: "tokens" | "messages" = at("contextMode") ?? "tokens";
  const context = mode === "messages" ? MAX_MESSAGES : SLIDERS.find((s) => s.key === "maxContext")!;
  return (
    <>
      {CORE_PARAMS.map((def) => {
        const { value, from } = coreValue(def, scene, body.samplers);
        const field = CORE_FIELD[def.id as CoreId];
        const write = (n: number): void => own.setSamplerValue(body.samplers, field, n as ChatPreset["samplers"][typeof field]);
        const shown = value ?? (def.default as number);
        const copy = { label: def.label, description: firstSentence(def.description) };
        // Full Chat's Core card: "Changed for this chat" with Reset to preset, which hands the field back to the preset's own value.
        const reset = from === "scene" && <ActionRow label={`Reset ${def.label}`} description="Changed for this chat." action="Reset to preset" onAction={() => own.setSamplerValue(body.samplers, field, body.samplers?.[field])} />;
        return (
          <div key={def.id}>
            {def.kind === "range"
              ? <SliderRow {...copy} value={shown} min={def.min!} max={def.max!} step={def.step!} onChange={write} />
              : <SavedNumber {...copy} saved={shown} min={def.min!} max={def.max!} step={def.step ?? 1} write={write} />}
            {reset}
          </div>
        );
      })}
      <SegmentedRow label="Context mode" description="Cut the history by tokens or by a count of messages." value={mode} options={[{ value: "tokens", label: "Tokens" }, { value: "messages", label: "Messages" }]} onChange={(m) => set("contextMode", m)} />
      <SliderRow key={mode} label={context.label} description={mode === "messages" ? "Previous messages the model sees; your newest message is always sent on top." : "Tokens the model sees at once; never more than the model's own window."}
        value={(mode === "messages" ? at("maxMessages") : at("maxContext")) ?? context.unset} min={context.min} max={context.max} step={context.step} onChange={(n) => set(mode === "messages" ? "maxMessages" : "maxContext", n)} />
      <SelectRow label="Prompt post-processing" description="How messages are formatted before they are sent." value={at("promptPostProcessing") ?? "none"} options={MERGE.map(([value, label]) => ({ value, label }))}
        onChange={(v) => set("promptPostProcessing", v as ChatPreset["samplers"]["promptPostProcessing"])} />
    </>
  );
}

/** Reasoning effort and continuity, Start Reply With, Catch thinking and the two switches that follow it: the scene's own prompting settings (ChatStore rule 37). */
function ThinkingRows({ prompting, notSent }: { prompting: PromptingView; notSent: boolean }): JSX.Element {
  const { view, write } = prompting;
  const stored = view.prefill ?? "";
  const capture = normalizeCapture(view.capture);
  const picked = new Set(capture.builtinTags);
  const tags = (on: boolean, tag: string): void => {
    const next = new Set(picked);
    if (on) next.add(tag); else next.delete(tag);
    write({ capture: { ...capture, custom: view.capture?.custom ?? capture.custom, builtinTags: BUILTIN_CAPTURE_OPTIONS.filter((t) => next.has(t)) } }, "Catch thinking");
  };
  return (
    <>
      <SelectRow label="Reasoning effort" description={notSent ? "This scene's connection takes no reasoning level, so nothing is sent." : "How hard the model thinks before it writes."} value={view.reasoningEffort ?? "auto"} options={EFFORTS}
        onChange={(v) => write({ reasoningEffort: v === "auto" ? null : (v as ChatReasoningEffort) }, "Reasoning Effort")} />
      <ToggleRow label="Reasoning continuity" description="Send earlier replies' signed thinking back to the model that wrote them. Anthropic connections only." on={view.continuity === true}
        onChange={(on) => write({ continuity: on ? true : null }, "Reasoning continuity")} />
      <CheckedText label="Start reply with" description="Text every reply begins with, such as <think>." saved={stored} rows={1} check={(t) => (t.length > 2000 ? "Use at most 2,000 characters." : null)}
        write={(t) => write({ prefill: t.trim() ? t : null }, "Start Reply With")} />
      <SegmentedRow label="Start reply with is sent as" value={view.prefillRole ?? "assistant"} options={ROLES} onChange={(r) => write({ prefillRole: r === "assistant" ? null : r }, "Start Reply With")} />
      <SegmentedRow<CaptureMode> label="Catch thinking" description="What is moved out of a reply into Behind the Scene." value={capture.mode} options={MODES}
        onChange={(mode) => { if (mode !== capture.mode) write({ capture: captureWithMode(view.capture, stored, mode) }, "Catch thinking"); }} />
      {capture.mode === "only" && BUILTIN_CAPTURE_OPTIONS.map((tag) => <ToggleRow key={tag} label={`Catch ${tag}`} on={picked.has(tag)} onChange={(on) => tags(on, tag)} />)}
      {capture.mode === "only" && <CustomTagRows prompting={prompting} />}
      <ToggleRow label="Let the model see its old thinking" description={firstSentence(paramById("keep_inline_thinking_tags")!.description)} on={view.keepThinking === true}
        onChange={(on) => write({ keepThinking: on ? true : null }, "Let the model see its old thinking")} />
      <ToggleRow label="Show prefill in chat" description="Show the start-reply-with text in the chat." on={view.showPrefill === true} onChange={(on) => write({ showPrefill: on ? true : null }, "Show Prefill in Chat")} />
    </>
  );
}

/** The body of the Samplers section. */
export function SamplersBody({ env }: { env: SceneEnv }): JSX.Element {
  const chat = chatOf(env);
  const { ctx } = env.a;
  const [warn, setWarn] = useState<string | null>(null);
  const preset = useBoothPreset(ctx, chat.preset ?? null);
  const own = useScenePresetOwn(ctx, chat, takeChat(env), setWarn);
  const prompting = usePromptingView(ctx, chat, takeChat(env));
  const provider = useGenerationProvider(ctx, chat);
  const effort = prompting.view.reasoningEffort;
  const body = own.own && preset.state === "ready" ? preset.body : null;
  return (
    <div data-part="scene.messenger.settings.writing.samplers">
      {body
        ? <CoreRows own={own} body={body} />
        : <DrillRow label="Sampler values" description={chat.preset ? "They load with the preset." : "They belong to the scene's preset. Choose one first."} {...(chat.preset ? {} : { value: "No preset" })} onOpen={() => env.open("prompts")} />}
      <ThinkingRows prompting={prompting} notSent={provider !== null && effort !== undefined && !provider.accepts.has("reasoning_effort")} />
      {body && <ParamRows env={env} own={own} presetSamplers={body.samplers} provider={provider} thinking={effort !== undefined && effort !== "none"} />}
      {warn && <p className="msn-st-secd" role="alert">{warn}</p>}
    </div>
  );
}
