/**
 * Settings section: Memory & Summaries (RoleCall Defaults, `DefaultsConfigurator.tsx` "Memory & Summaries"; rc-parity 08, follow-up 2): the chat-summary settings a scene starts with. One pref,
 * `scenes.summaryDefaults`, holds only the keys the person changed (sparse, like a scene's own), and startScene copies it onto each scene as it is started, so a scene already started keeps its own
 * settings. Each control writes its own keys by the same couplings as the Memory tab (core/summary/couplings.ts). The summary model is not a default: it is chosen per scene, where the scene's models are.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { autoPatch, hidePatch, intervalPatch, methodPatch, optionOf } from "../../../../core/summary/couplings";
import { DEFAULT_SUMMARY_PREF, SUMMARY_DEFAULTS, contextWindow, resolveSummary } from "../../../../core/summary/settings";
import type { BackfillMode } from "../../../../core/summary/prompts";
import type { SummarySettings, SummarySettingsPatch } from "../../../../stage/contracts/chat-store";
import { checkSummarySettings, mergeSummarySettings, summaryDefaultsOf } from "../../../../stage/store/summary-rules";
import { numOrNull } from "../../../../core/guards";
import { toErrorMessage } from "../../../_shared/error-message";
import { SegControl, SettingsRow, type SettingsSection } from "../section-contract";
import styles from "./memory.module.css";

type OnOff = "on" | "off";
const ON_OFF = [{ value: "off" as const, label: "Off" }, { value: "on" as const, label: "On" }];

/** A number that keeps what is typed and writes when you leave the box: null for an empty or unusable one. */
function NumberInput({ label, value, min, step = 1, float = false, onCommit }: { label: string; value: number; min: number; step?: number; float?: boolean; onCommit(n: number | null): void }): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft === null) return;
    setDraft(null);
    const n = numOrNull(float ? Number.parseFloat(draft) : Number.parseInt(draft, 10));
    if (String(n ?? "") !== String(value)) onCommit(n);
  };
  return (
    <input className={styles.num} type="number" aria-label={label} min={min} step={step} value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
  );
}

function MemorySection({ ctx }: { ctx: AppContext }): JSX.Element {
  const raw = ctx.prefs.get(DEFAULT_SUMMARY_PREF);
  const [saved, setSaved] = useState<SummarySettings | undefined>(() => (summaryDefaultsOf(raw) ?? undefined) as SummarySettings | undefined);
  // A record that is there but is not valid settings is said so, never shown as if the built-in defaults were the person's.
  const [unreadable] = useState(() => raw !== undefined && raw !== null && !(typeof raw === "object" && Object.keys(raw).length === 0) && summaryDefaultsOf(raw) === null);
  const r = resolveSummary(saved);
  const [problem, setProblem] = useState<string | null>(null);
  const put = (patch: SummarySettingsPatch): void => {
    try {
      const next = mergeSummarySettings(saved, checkSummarySettings(patch));
      ctx.prefs.set(DEFAULT_SUMMARY_PREF, next ?? null);
      setSaved(next);
      setProblem(null);
    } catch (e) {
      // A value the settings refuse (a number past its limit) is said, and nothing is saved.
      setProblem(toErrorMessage(e, "That value could not be saved."));
    }
  };
  const option = optionOf(r);
  const kept = r.keepRecent ?? contextWindow(r) ?? SUMMARY_DEFAULTS.keepRecent;
  return (
    <>
      <p className={styles.note}>These apply to scenes you start from now on. A scene already started keeps its own settings (Context wing, Memory).</p>
      {unreadable ? <p className={styles.alert} role="alert">The saved defaults could not be read, so the built-in ones are shown. Changing a setting here replaces them.</p> : null}
      {problem ? <p className={styles.alert} role="alert">{problem}</p> : null}
      <SettingsRow label="Automatic summaries" hint={`Create a summary on its own. Turning it on summarizes every ${SUMMARY_DEFAULTS.enabledInterval} messages.`}>
        <SegControl<OnOff> options={ON_OFF} current={r.auto && (r.method === "pair" || r.interval > 0) ? "on" : "off"} onPick={(v) => put(autoPatch(r, v === "on"))} />
      </SettingsRow>
      {r.method !== "pair" ? (
        <SettingsRow label="Summarize every" hint="The number of messages between automatic recaps. Zero turns automatic summaries off.">
          <NumberInput label="Summarize every" value={r.interval} min={0} onCommit={(n) => put(intervalPatch(n ?? 0))} />
        </SettingsRow>
      ) : null}
      <SettingsRow label="Include saved summary in AI context" hint="Send the saved summary to the model with each reply.">
        <SegControl<OnOff> options={ON_OFF} current={r.include ? "on" : "off"} onPick={(v) => put({ include: v === "on" })} />
      </SettingsRow>
      <SettingsRow label="Hide messages already covered" hint="Older messages the summary covers leave future prompts but stay in the scene. Needs the summary to be sent.">
        <SegControl<OnOff> options={ON_OFF} current={r.hideOld ? "on" : "off"} disabled={!r.include} onPick={(v) => { if ((v === "on") !== r.hideOld) put(hidePatch(r)); }} />
      </SettingsRow>
      {r.hideOld && r.include ? (
        <SettingsRow label="Keep recent messages visible to AI" hint="The newest messages kept word for word beside the summary.">
          <NumberInput label="Keep recent messages visible to AI" value={kept} min={1} onCommit={(n) => put({ keepRecent: n !== null && n > 0 ? n : null })} />
        </SettingsRow>
      ) : null}
      <SettingsRow label="Summary method" hint="Rolling recap rewrites one block, Growing timeline extends it, Every exchange adds a line after each reply.">
        <SegControl<BackfillMode> options={[{ value: "replace", label: "Rolling recap" }, { value: "additive", label: "Growing timeline" }, { value: "pair", label: "Every exchange" }]} current={option} onPick={(v) => put(methodPatch(r, v))} />
      </SettingsRow>
      <SettingsRow label="Temperature" hint="Lower values make recaps steadier; higher values allow looser wording.">
        <NumberInput label="Temperature" value={r.temperature} min={0} step={0.1} float onCommit={(n) => put({ temperature: n === null ? null : Math.min(1, Math.max(0, n)) })} />
      </SettingsRow>
      <SettingsRow label="Max output tokens" hint="The most a summary may use.">
        <NumberInput label="Max output tokens" value={r.maxTokens} min={1} onCommit={(n) => put({ maxTokens: n !== null && n > 0 ? n : null })} />
      </SettingsRow>
      <button type="button" className={styles.reset} onClick={() => { ctx.prefs.set(DEFAULT_SUMMARY_PREF, null); setSaved(undefined); }}>Back to built-in defaults</button>
    </>
  );
}

const section: SettingsSection = { id: "memory", label: "Memory & Summaries", order: 31, Component: MemorySection };
export default section;
