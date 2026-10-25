/**
 * The Memory tab, RoleCall's Chat Summary (`MemoryPanel.tsx`, live part only: its per-message memories are dead code behind `{false ? ...}`, rc-parity 08): the hero and four tiles (Method, Runs, AI Context, the model), the
 * "Summary Controls" card (automation, Include in AI context, Summary Model, Temperature, Summarize every, Hide messages already covered, Keep recent, and Advanced settings with the method, window, reasoning, output budget,
 * truncation and the prompt template), and the "Current Summary" card (read, write, edit, Backfill history). Every control writes its own key through use-summary.ts; the words and the couplings are memory-core.ts's.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { bodyOf, recOr, str } from "../../../../core/guards";
import { rollingPrompt, PAIR_PROMPT } from "../../../../core/summary/prompts";
import { SUMMARY_DEFAULTS, automationActive, contextWindow, resolveSummary, summaryWindow } from "../../../../core/summary/settings";
import { BoothModelPicker } from "../booth-model-picker";
import { useSceneModels } from "../use-scene-models";
import type { ContextProps } from "./context-wing";
import { Disclosure, Field, NumberBox, SwitchRow } from "./memory-controls";
import { autoPatch, backfillLabel, compactModelName, contextLabel, controlsLine, heroSubtitle, hidePatch, intervalPatch, methodLabel, methodPatch, optionOf, promptVariables, timingLabel } from "./memory-core";
import { useSummary } from "./use-summary";

const FOLDS = "context.memoryFolds";
type Folds = { advanced: boolean; prompt: boolean };

export function MemoryTab({ ctx, scene, onChat }: ContextProps): JSX.Element {
  const chat = scene.chat;
  const view = useSummary(ctx, chat);
  const models = useSceneModels(ctx, chat, onChat);
  const [folds, setFolds] = useState<Folds>(() => { const f = recOr(ctx.prefs.get(FOLDS)); return { advanced: f["advanced"] === true, prompt: f["prompt"] === true }; });
  const fold = (key: keyof Folds, open: boolean): void => { const next = { ...folds, [key]: open }; setFolds(next); ctx.prefs.set(FOLDS, next); };
  const [editing, setEditing] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const name = str(recOr(bodyOf(scene.snapshot.character)["identity"])["name"]) || "this chat";

  if (view.load.state !== "ready") {
    return <div className="wbody mm"><div className="quiet"><div>{view.load.state === "failed" ? <p role="alert">{view.load.why}</p> : <b>Loading the summary...</b>}</div></div></div>;
  }
  const s = view.load.s;
  const r = resolveSummary(s.settings);
  const option = optionOf(r);
  const active = automationActive(r);
  const model = r.model ?? chat.connection;
  const shownError = view.runError ?? s.error;
  const put = (patch: Parameters<typeof view.patch>[0]): void => { void view.patch(patch); };
  const save = async (): Promise<void> => {
    const failed = await view.save(editing ?? "");
    setSaveError(failed);
    if (!failed) setEditing(null);
  };

  return (
    <div className="wbody mm" data-part="scene.context.memory">
      <header className="hero">
        <span className="hi"><Ic name="lucide:sparkles" size={20} /></span>
        <div><div className="eb">Long-term recall</div><h2>Chat <em>Summary</em></h2><p>{heroSubtitle(r, name)}</p></div>
      </header>
      <div className="mm-stats">
        <div><small>Method</small><b>{methodLabel(option)}</b></div>
        <div><small>Runs</small><b>{timingLabel(r)}</b></div>
        <div><small>AI Context</small><b>{contextLabel(r)}</b></div>
        <div><small>{r.model ? "Custom" : "Default"}</small><b className="wrap">{compactModelName(model?.model ?? "none")}</b></div>
      </div>

      <section className={`mm-card${active ? " on" : ""}`} aria-label="Summary Controls">
        <div className="mm-sec"><Ic name="lucide:settings-2" size={14} />Summary Controls<small>Essentials</small></div>
        <p className="mm-line">{controlsLine(r)}</p>
        <SwitchRow icon="lucide:sparkles" title={active ? "Automatic summaries are on" : "Automatic summaries are off"} checked={active} onChange={() => put(autoPatch(r, !active))}
          description={active ? "Turn this off to stop creating new summaries. Your saved summary remains available for manual editing and context." : `Turn this on to create a summary every ${SUMMARY_DEFAULTS.enabledInterval} messages.`} />
        <SwitchRow icon="lucide:brain" title="Include saved summary in AI context" checked={r.include} onChange={() => put({ include: !r.include })}
          description="When on, the AI receives the current saved summary with future replies. Turn it off to keep the summary stored without sending it to the model." />
        {shownError ? <div role="alert" className="mm-err"><b>Last summary run failed:</b> {shownError}</div> : null}
        <Field label="Summary Model" hint="Uses this scene's model unless you choose another.">
          <BoothModelPicker current={model} models={models} onPick={(c) => put({ model: c })} />
        </Field>
        {r.model ? (
          <div className="mm-note"><span>This chat overrides its normal model for summaries.</span><button type="button" onClick={() => put({ model: null })}>Use chat model</button></div>
        ) : null}
        <Field label="Temperature" hint="Lower values make recaps steadier; higher values allow looser wording.">
          <NumberBox label="Temperature" value={r.temperature} min={0} step={0.1} float onCommit={(n) => put({ temperature: n === null ? null : Math.min(1, Math.max(0, n)) })} />
        </Field>
        {r.method !== "pair" ? (
          <Field label="Summarize every" hint="The number of persisted messages between automatic recaps.">
            <NumberBox label="Summarize every" value={r.interval} min={0} onCommit={(n) => put(intervalPatch(n ?? 0))} />
          </Field>
        ) : null}
        <SwitchRow icon="lucide:eye-off" title="Hide messages already covered by the summary" checked={r.hideOld} disabled={!r.include} onChange={() => put(hidePatch(r))}
          description="Older covered messages leave future AI prompts but stay visible in chat. Nothing is deleted." />
        {r.hideOld && r.include ? (
          <Field label="Keep recent messages visible to AI" hint="The newest messages kept verbatim alongside the saved summary.">
            <NumberBox label="Keep recent messages visible to AI" value={r.keepRecent ?? contextWindow(r) ?? SUMMARY_DEFAULTS.keepRecent} min={1} onCommit={(n) => put({ keepRecent: n !== null && n > 0 ? n : null })} />
          </Field>
        ) : null}

        <Disclosure open={folds.advanced} onToggle={(o) => fold("advanced", o)} icon="lucide:sliders-horizontal" title="Advanced settings" hint={`${methodLabel(option)} · Optional`}>
          <p className="mm-line box">The defaults suit most chats. Open this only to change the summary method, input window, model limits, or prompt instructions.</p>
          <Field label="Summary method" hint={option === "pair" ? "Appends one turn line per exchange, then uses the summary as compressed context." : option === "additive" ? "Adds the newest window to the existing summary block." : "Rewrites the summary block into a compact recap."}>
            <select className="mm-in" value={option} aria-label="Summary method" onChange={(e) => put(methodPatch(r, e.target.value as typeof option))}>
              <option value="replace">Rolling recap (recommended)</option>
              <option value="additive">Growing timeline</option>
              <option value="pair">Every exchange</option>
            </select>
          </Field>
          {option === "pair" ? <div className="mm-note on">Per-pair mode appends one sentence to the summary after each assistant reply. It makes one summary-model API call per completed exchange.</div> : null}
          {option !== "pair" ? (
            <Field label="Messages included in each summary" hint={`Leave blank to match the ${r.interval || "current"}-message cadence. Current input: ${summaryWindow(r) !== undefined ? `${summaryWindow(r)} messages` : "All supplied messages"}.`}>
              <NumberBox label="Messages included in each summary" value={r.window} min={1} placeholder={r.interval > 0 ? `Same as interval (${r.interval})` : "All supplied messages"} onCommit={(n) => put({ window: n !== null && n > 0 ? n : null })} />
            </Field>
          ) : null}
          <SwitchRow icon="lucide:brain" title="Enable reasoning" checked={r.reasoning} onChange={() => put({ reasoning: !r.reasoning })}
            description="Uses low reasoning effort when the selected model supports it. This shares the output-token budget below." />
          <Field label="Max output tokens" hint="Maximum size of each generated summary. Long backfills may use multiple calls.">
            <NumberBox label="Max output tokens" value={r.maxTokens} min={1} onCommit={(n) => put({ maxTokens: n !== null && n > 0 ? n : null })} />
          </Field>
          <SwitchRow icon="lucide:file-text" title="Truncate messages" checked={r.truncate} onChange={() => put({ truncate: !r.truncate })}
            description={`Limits each source message to ${SUMMARY_DEFAULTS.sourceLimit} characters before summary generation.`} />
          <Disclosure open={folds.prompt} onToggle={(o) => fold("prompt", o)} icon="lucide:scroll-text" title="Prompt template" hint="Custom">
            <div className="mm-vars">
              <span>Variables: {promptVariables(option).map((v) => <code key={v}>{v}</code>)}. {option === "pair" ? "Missing source variables are appended automatically." : "Missing history is appended automatically."}</span>
              <button type="button" disabled={!r.prompt} onClick={() => put({ prompt: null })}><Ic name="lucide:refresh-cw" size={14} />Reset prompt</button>
            </div>
            <PromptBox key={r.prompt ?? ""} saved={r.prompt} fallback={option === "pair" ? PAIR_PROMPT : rollingPrompt(r.mode, false)} onCommit={(text) => put({ prompt: text.trim() === "" ? null : text })} />
            {!r.prompt ? <p className="mm-line">No custom prompt: the built-in prompt for {methodLabel(option)} is used.</p> : null}
          </Disclosure>
        </Disclosure>
      </section>

      <section className="mm-card" aria-label="Current Summary">
        <div className="mm-sec"><Ic name="lucide:scroll-text" size={14} />Current Summary<small>{s.text ? `${s.text.length} chars` : "Empty"}</small>
          {editing === null && s.text ? <button type="button" className="mm-icon" title="Edit summary" aria-label="Edit summary" onClick={() => { setSaveError(null); setEditing(s.text); }}><Ic name="lucide:pencil" size={14} /></button> : null}
        </div>
        {s.running ? (
          <div className="mm-wait"><Ic name="lucide:loader-circle" size={24} /><p>Generating summary...</p></div>
        ) : editing !== null ? (
          <div className="mm-edit">
            <textarea className="mm-in tall" aria-label="Summary text" autoFocus placeholder="Write the context the AI should carry forward..." value={editing} onChange={(e) => setEditing(e.target.value)} />
            {saveError ? <p role="alert" className="mm-err">{saveError}</p> : null}
            <div className="mm-acts">
              <button type="button" className="mm-btn" disabled={view.busy} onClick={() => { setEditing(null); setSaveError(null); }}>Cancel</button>
              <button type="button" className="mm-btn go" disabled={editing.trim() === "" || view.busy} onClick={() => void save()}><Ic name={view.busy ? "lucide:loader-circle" : "lucide:check"} size={14} />Save</button>
            </div>
          </div>
        ) : s.text ? (
          <div className="mm-text"><p>{s.text}</p></div>
        ) : (
          <div className="mm-empty">
            <Ic name="lucide:sparkles" size={24} />
            <p>No summary yet</p>
            <small>{r.auto ? "Write the starting context yourself, or let the next eligible exchange create it." : "Write the context you want the AI to carry forward."}</small>
            <button type="button" className="mm-btn go" onClick={() => { setSaveError(null); setEditing(""); }}><Ic name="lucide:pencil" size={14} />Write summary</button>
          </div>
        )}
        {editing === null ? (
          <div className="mm-back">
            <p>This run: <b>{backfillLabel(option)}</b>. Full history is loaded and split adaptively for the selected model. You can switch methods afterward.</p>
            <button type="button" className="mm-btn" disabled={s.running || view.busy} onClick={() => void view.backfill()}><Ic name={s.running ? "lucide:loader-circle" : "lucide:refresh-cw"} size={14} />Backfill history</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** The prompt box: what is typed stays until you leave it; empty shows the built-in prompt as a placeholder. */
function PromptBox({ saved, fallback, onCommit }: { saved: string | undefined; fallback: string; onCommit(text: string): void }): JSX.Element {
  const [text, setText] = useState(saved ?? "");
  return <textarea className="mm-in tall mono" aria-label="Prompt template" spellCheck={false} placeholder={fallback} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== (saved ?? "")) onCommit(text); }} />;
}
