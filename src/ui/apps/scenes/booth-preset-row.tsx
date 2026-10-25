/**
 * The Control Booth's Active Preset card and Generation (Quick) block (RoleCall's QuickPlayPanel,
 * :1549-1616 and :1906-2092). The card names the scene's preset with the tokens of its enabled prompts
 * (the real counter, not RoleCall's chars/4 over every prompt, flaw F5) and opens Prompting to change it.
 * Generation is the Prompting wing's own SamplerBar and the same debounced writer (use-scene-preset-own.ts),
 * so a slider moved here is the write the Preset tab would make. Samplers belong to the scene's preset
 * (ChatStore rule 19), so without one there is nothing to set and the block says where to start.
 */
import type { JSX } from "react";
import type { PresetBody } from "../../../entities/preset/schema";
import { countText } from "../../../core/tokens";
import { Ic } from "../../_shared/ic";
import type { Chat, ChatPreset } from "../../../stage/contracts/chat-store";
import { contextMaxed } from "./booth-generation-core";
import { isOn, type SamplerKey, type Toggles } from "./preset-core";
import { SamplerBar } from "./scene-preset-parts";
import type { BoothPreset } from "./use-booth-preset";
import type { ScenePresetOwn } from "./use-scene-preset-own";

const tokensOf = (body: PresetBody, toggles: Toggles): number =>
  body.prompts.filter((p) => isOn(p, toggles) && !p.marker).reduce((n, p) => n + countText(p.content), 0);

export function BoothPresetCard({ chat, preset, own, onOpen }: { chat: Chat; preset: BoothPreset; own: ScenePresetOwn; onOpen(): void }): JSX.Element {
  return (
    <section className="bth-sec" data-part="scene.booth.preset">
      <h3>Active Preset</h3>
      {!chat.preset && <button type="button" className="bth-empty" onClick={onOpen}>No preset selected. Choose in Prompting</button>}
      {chat.preset && preset.state === "loading" && <p className="bth-quiet"><Ic name="lucide:loader-circle" size={16} /> Loading...</p>}
      {chat.preset && preset.state === "failed" && <p className="bth-quiet" role="alert">The preset could not be read: {preset.why}.</p>}
      {chat.preset && preset.state === "gone" && (
        <p className="bth-note warn" role="status">This scene&apos;s preset is no longer in your library. Choose another, or restore it from the Trash.</p>
      )}
      {chat.preset && preset.state === "ready" && (
        <button type="button" className="bth-pick" aria-label="Open Prompting to change the active preset" onClick={onOpen}>
          <span className="bth-tile"><Ic name="mdi:tune" size={20} /></span>
          <span className="pn"><span>{preset.body.name}</span><small>~{tokensOf(preset.body, own.own?.toggles ?? chat.preset.toggles).toLocaleString()} tokens</small></span>
        </button>
      )}
    </section>
  );
}

export function BoothGeneration({ chat, preset, own, windowTokens }: { chat: Chat; preset: BoothPreset; own: ScenePresetOwn; windowTokens: number | undefined }): JSX.Element {
  const body = preset.state === "ready" ? preset.body : null;
  const maxed = body && own.own ? contextMaxed(windowTokens, own.own.samplers.maxContext ?? body.samplers?.maxContext) : null;
  return (
    <section className="bth-sec" data-part="scene.booth.generation">
      <h3>Generation (Quick)</h3>
      {body && own.own ? (
        <>
          <SamplerBar booth preset={body.samplers ?? {}} own={own.own.samplers} onSet={<K extends SamplerKey>(key: K, value: ChatPreset["samplers"][K]) => own.setSamplerValue(body.samplers, key, value)} />
          {maxed !== null && (
            <p className="bth-maxed" role="status">Context maxed: every message resends up to {maxed.toLocaleString()} tokens of history as input, which drains your token allowance quickly. Lower Context tokens to reduce cost per message.</p>
          )}
        </>
      ) : (
        <p className="bth-quiet">{chat.preset ? "Generation settings load with the preset." : "Generation settings belong to the scene's preset. Choose one in Prompting."}</p>
      )}
    </section>
  );
}
