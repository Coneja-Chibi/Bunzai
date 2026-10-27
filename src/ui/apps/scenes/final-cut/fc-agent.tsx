/**
 * Your Department's controls (RoleCall's CustomAgentControls, PresetPromptToggles and CustomAgentLibrary, PostProductionPanel.tsx:2247-2364,
 * CustomAgentLibrary.tsx): the saved-agent library (save the pass as an agent, load one onto it, delete with a second click), the
 * department name, an attached preset as the agent's rulebook with a switch for each entry, and the instruction. A saved agent carries the
 * instruction, preset, model, temperature and context, so loading one sets exactly what saving read.
 */
import { useEffect, useState, type JSX } from "react";
import { Button } from "../../../components/button";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { FinalCutPass } from "../../../../core/final-cut/pass";
import { bodyOf } from "../../../../core/guards";
import type { AgentRecord } from "../../../../studio/final-cut-library";
import type { PresetPrompt } from "../../../../entities/preset/schema";
import { Area, Line } from "./fc-controls";
import { FailureModeSelect, OutputModeToggle, type Change } from "./fc-pass-chrome";
import type { FinalCutLibrary } from "./use-final-cut-library";

/** What saving an agent reads off the pass. */
const agentOf = (pass: FinalCutPass, name: string): Record<string, unknown> => ({
  name, instructions: pass.agentPrompt ?? "",
  ...(pass.connection ? { connection: pass.connection } : {}), ...(pass.temperature !== undefined ? { temperature: pass.temperature } : {}), ...(pass.contextMessages !== undefined ? { contextMessages: pass.contextMessages } : {}),
  ...(pass.customPresetId ? { presetId: pass.customPresetId } : {}), ...(pass.customPresetName ? { presetName: pass.customPresetName } : {}), ...(pass.customPresetPromptStates && Object.keys(pass.customPresetPromptStates).length > 0 ? { presetPromptStates: pass.customPresetPromptStates } : {}),
});

/** What loading an agent sets on the pass; what the agent does not carry is cleared, so the pass is exactly the agent. */
const passOf = (a: AgentRecord): Partial<FinalCutPass> => ({
  label: a.name, agentPrompt: a.instructions, connection: a.connection, temperature: a.temperature, contextMessages: a.contextMessages,
  customPresetId: a.presetId ?? null, customPresetName: a.presetName ?? null, customPresetPromptStates: a.presetPromptStates ?? {},
});

function SavedAgents({ pass, lib, onChange }: { pass: FinalCutPass; lib: FinalCutLibrary; onChange: Change }): JSX.Element {
  const [name, setName] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (): Promise<void> => {
    if (!name?.trim()) return;
    setSaving(true);
    const made = await lib.saveAgent(agentOf(pass, name.trim()));
    setSaving(false);
    if (made) setName(null);
  };
  return (
    <section className="fc-saved" data-part="scene.finalcut.agents">
      <header>
        <div>
          <h4>Saved Agents</h4>
          <p>{lib.state === "loading" ? "Loading..." : lib.agents.length === 0 ? "Save this agent to reuse it on any chat. Its instruction, model, and preset travel with it." : `${lib.agents.length} saved · load one onto this pass, or save the current setup.`}</p>
        </div>
        <Button size="sm" aria-expanded={name !== null} onClick={() => setName(name === null ? (pass.label && pass.label !== "Custom Department" ? pass.label : "") : null)}>{name === null ? "+ Save current" : "Cancel"}</Button>
      </header>
      {lib.error && <div className="fc-error" role="alert">{lib.error}</div>}
      {name !== null && (
        <div className="fc-save-row">
          <div className="line">
            <input className="fc-field" value={name} maxLength={120} autoFocus placeholder="Name this agent (e.g. Pacing Doctor)" aria-label="Agent name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void save(); }} />
            <Button variant="primary" size="sm" disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? "Saving..." : "Save to account"}</Button>
          </div>
          <small>Captures the instruction, attached preset, model, and sampling from the controls below. Reusing an existing name overwrites it.</small>
        </div>
      )}
      {lib.agents.length > 0 && (
        <ul className="fc-list">
          {lib.agents.map((a) => {
            const loaded = (pass.agentPrompt ?? "") === a.instructions && (pass.label ?? "") === a.name;
            return (
              <li key={a.id} className={loaded ? "on" : undefined}>
                <div className="body">
                  <div className="row"><b>{a.name}</b>{a.presetName && <span className="fc-chip">{a.presetName}</span>}{a.connection && <small>{a.connection.model}</small>}</div>
                  <p>{a.instructions ? a.instructions.slice(0, 160) : "(no instruction)"}</p>
                </div>
                <div className="acts">
                  <Button size="sm" onClick={() => { onChange(passOf(a)); setConfirm(null); }}>{loaded ? "Loaded" : "Load"}</Button>
                  <Button variant="danger" size="sm" onClick={() => { if (confirm === a.id) { void lib.deleteAgent(a.id); setConfirm(null); } else setConfirm(a.id); }}>{confirm === a.id ? "Confirm" : "Delete"}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The attached preset's entries, each with the switch the agent reads (the person's switch, else the entry's own). */
/** The attached preset's prompt entries (markers left out); null while they load or when no preset is attached. */
export function usePresetPrompts(ctx: AppContext, presetId: string | null | undefined): PresetPrompt[] | null {
  const [prompts, setPrompts] = useState<PresetPrompt[] | null>(null);
  useEffect(() => {
    setPrompts(null);
    if (!presetId) return;
    let live = true;
    ctx.api.getEntity(`kind=preset&id=${encodeURIComponent(presetId)}`).then((e) => live && setPrompts(((bodyOf(e)["prompts"] as PresetPrompt[] | undefined) ?? []).filter((p) => !p.marker)), () => live && setPrompts([]));
    return () => { live = false; };
  }, [ctx, presetId]);
  return prompts;
}

/** The person's presets, for the agent's rulebook picker. */
export function usePresetList(ctx: AppContext): StudioEntitySummary[] | "loading" | "failed" {
  const [presets, setPresets] = useState<StudioEntitySummary[] | "loading" | "failed">("loading");
  useEffect(() => {
    let live = true;
    ctx.api.listEntities("preset").then((l) => live && setPresets(l), () => live && setPresets("failed"));
    return () => { live = false; };
  }, [ctx]);
  return presets;
}

function Rulebook({ ctx, pass, onChange }: { ctx: AppContext; pass: FinalCutPass; onChange: Change }): JSX.Element | null {
  const prompts = usePresetPrompts(ctx, pass.customPresetId);
  if (!pass.customPresetId) return null;
  if (prompts === null) return <div className="fc-note">Loading your preset library...</div>;
  if (prompts.length === 0) return <div className="fc-note">Selected preset has no prompt entries available.</div>;
  const states = pass.customPresetPromptStates ?? {};
  return (
    <div className="fc-preset" data-part="scene.finalcut.rulebook">
      <b>Preset entries used by this agent</b>
      <div className="fc-rules">
        {prompts.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (p) => (
          <label key={p.id} className="fc-entry">
            <input type="checkbox" checked={states[p.id] ?? p.enabled} onChange={(e) => onChange({ customPresetPromptStates: { ...states, [p.id]: e.target.checked } })} />
            <span className="fc-box" aria-hidden="true" />
            <span><b>{p.name}</b><em>{p.id} - {p.content?.slice(0, 92) || "empty prompt"}</em></span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AgentControls({ ctx, pass, lib, onChange }: { ctx: AppContext; pass: FinalCutPass; lib: FinalCutLibrary; onChange: Change }): JSX.Element {
  const presets = usePresetList(ctx);
  const list = Array.isArray(presets) ? presets : [];
  return (
    <div className="fc-controls">
      <SavedAgents pass={pass} lib={lib} onChange={onChange} />
      <div className="fc-grid">
        <Line label="Department name" value={pass.label ?? "Custom Department"} onChange={(label) => onChange({ label })} />
        <FailureModeSelect value={pass.failureMode} onChange={(failureMode) => onChange({ failureMode })} />
      </div>
      <OutputModeToggle value={pass.outputMode} onChange={(outputMode) => onChange({ outputMode })} />
      <label className="fc-label">Attach a preset rulebook
        <select className="fc-select" value={pass.customPresetId ?? ""} onChange={(e) => onChange({ customPresetId: e.target.value || null, customPresetName: list.find((p) => p.id === e.target.value)?.name ?? null, customPresetPromptStates: {} })}>
          <option value="">No attached preset</option>
          {list.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {presets === "loading" && <div className="fc-note">Loading your preset library...</div>}
      {presets === "failed" && <div className="fc-note">Preset library failed to load.</div>}
      {Array.isArray(presets) && presets.length === 0 && <div className="fc-note">No accessible presets found. Create a preset to use it as this agent's rulebook.</div>}
      <Rulebook ctx={ctx} pass={pass} onChange={onChange} />
      <Area label="Agent instruction" value={pass.agentPrompt ?? ""} placeholder="Tighten pacing, keep dialogue unchanged, and flag lore contradictions." onChange={(agentPrompt) => onChange({ agentPrompt })} />
    </div>
  );
}

