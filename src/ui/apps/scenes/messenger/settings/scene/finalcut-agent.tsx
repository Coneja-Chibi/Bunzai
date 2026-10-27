/**
 * The Your department (custom agent) pass's page (Full Chat's AgentControls, fc-agent.tsx): the department name, failure mode, output mode, an attached preset as the agent's rulebook with a switch for each of its entries,
 * and the instruction, over the shared model, temperature and context rows. Each row writes `useFinalCut.patch`; the presets and their entries are read by the hooks the Full Chat controls use. The saved-agent library
 * (save this setup, load one, delete) is a tool and stays in the Final Cut program.
 */
import type { JSX } from "react";
import { usePresetList, usePresetPrompts } from "../../../final-cut/fc-agent";
import { DrillRow, SelectRow, TextAreaRow, ToggleRow } from "../../frames/settings-rows";
import type { SceneEnv } from "./env";
import { FailureRow, NOTE, OutputModeRow, PassBody, PassChromeRows, type PassPage } from "./finalcut-kit";

function AgentRows({ env, page }: { env: SceneEnv; page: PassPage }): JSX.Element {
  const { pass, change } = page;
  const presets = usePresetList(env.a.ctx);
  const prompts = usePresetPrompts(env.a.ctx, pass.customPresetId);
  const list = Array.isArray(presets) ? presets : [];
  const states = pass.customPresetPromptStates ?? {};
  const chosen = pass.customPresetId ?? "";
  const options = [{ value: "", label: "No attached preset" }, ...(chosen && !list.some((p) => p.id === chosen) ? [{ value: chosen, label: pass.customPresetName ?? chosen }] : []), ...list.map((p) => ({ value: p.id, label: p.name }))];
  return (
    <>
      <PassChromeRows page={page} type="custom-agent" />
      <TextAreaRow label="Department name" value={pass.label ?? "Custom Department"} rows={1} onChange={(label) => change({ label })} />
      <FailureRow value={pass.failureMode} onChange={(failureMode) => change({ failureMode })} />
      <OutputModeRow value={pass.outputMode} onChange={(outputMode) => change({ outputMode })} />
      <SelectRow label="Attach a preset rulebook" description="The preset's entries become the agent's rules." value={chosen} options={options}
        onChange={(id) => change({ customPresetId: id || null, customPresetName: list.find((p) => p.id === id)?.name ?? null, customPresetPromptStates: {} })} />
      {presets === "loading" && <p className={NOTE} role="status">Loading your preset library...</p>}
      {presets === "failed" && <p className={NOTE}>The preset library failed to load.</p>}
      {Array.isArray(presets) && presets.length === 0 && <p className={NOTE}>No presets found. Create a preset to use it as this agent's rulebook.</p>}
      {chosen && prompts === null && <p className={NOTE} role="status">Loading the preset's entries...</p>}
      {chosen && prompts !== null && prompts.length === 0 && <p className={NOTE}>The selected preset has no prompt entries.</p>}
      {/* bounded-ok: the entries of one attached preset, authored by the person */}
      {(prompts ?? []).map((p) => (
        <ToggleRow key={p.id} label={p.name} description={p.content?.slice(0, 92) || "Empty prompt."} on={states[p.id] ?? p.enabled} onChange={(on) => change({ customPresetPromptStates: { ...states, [p.id]: on } })} />
      ))}
      <TextAreaRow label="Agent instruction" description="Tighten pacing, keep dialogue unchanged, and flag lore contradictions." value={pass.agentPrompt ?? ""} rows={5} onChange={(agentPrompt) => change({ agentPrompt })} />
      <DrillRow label="Saved agents" description="Save this setup, load one onto the pass, or delete one." onOpen={() => env.open("post-production")} />
    </>
  );
}

export function AgentPage({ env }: { env: SceneEnv }): JSX.Element {
  return <PassBody env={env} type="custom-agent" part="agent" label="Your department" description="A pass with your own instruction.">{(page) => <AgentRows env={env} page={page} />}</PassBody>;
}
