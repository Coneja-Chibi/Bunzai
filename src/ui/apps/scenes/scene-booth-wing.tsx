/**
 * The Control Booth (RoleCall's QuickPlayPanel, QuickPlayPanel.tsx:1494-2092): the scene's quick-access
 * hub. It only composes. Each row is the home wing's own module and writes through the same
 * ctx.api.setScene* setter, so nothing here keeps a copy of scene state: the header reads the chat the
 * page holds, and a row's change comes back as the page's new chat. The loadout bar (loadout/loadout-bar.tsx) sits under the
 * status tiles as in RoleCall; its writes come back through onSettings. RoleCall's Narrator section (the Story Director row, personality and model) closes the page (props/story-director/director-booth.tsx). Its voice picker and
 * image generation are out of scope; the rows follow RoleCall's order and arrive slice by slice.
 */
import { useState, type CSSProperties, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { Ic } from "../../_shared/ic";
import { Toggle } from "../../components/button";
import { protect } from "../../_shared/protected-control";
import { toErrorMessage } from "../../_shared/error-message";
import { TOOL_ROUNDS_DEFAULT, TOOL_ROUNDS_MAX, TOOL_ROUNDS_MIN } from "../../../core/assembly/tool-rounds";
import { LoreNum } from "./lore-fields";
import type { LoadoutUnit } from "../../../core/loadout-panels";
import { LoadoutBar } from "./loadout/loadout-bar";
import { BoothLoreRow } from "./booth-lore-row";
import { BoothNavigator } from "./booth-navigator";
import { BoothReadout } from "./booth-readout";
import { BoothSummaryRow } from "./booth-summary-row";
import { LastAsUserRow } from "./scene-last-as-user-row";
import { DirectorBooth } from "./props/story-director/director-booth";
import { BoothModelRow } from "./booth-model-row";
import { BoothGeneration, BoothPresetCard } from "./booth-preset-row";
import { useSceneModels } from "./use-scene-models";
import { useBoothPreset, type BoothPreset } from "./use-booth-preset";
import { useScenePresetOwn } from "./use-scene-preset-own";
import { useDirectorOn } from "./use-director-on";

/** What the Preset tile reads. */
function presetTile(chat: Chat, preset: BoothPreset): string {
  if (!chat.preset) return "No preset";
  if (preset.state === "ready") return preset.body.name;
  if (preset.state === "gone") return "Not in your library";
  return preset.state === "failed" ? "Could not read it" : "Loading...";
}

export function BoothWing({ ctx, scene, busy, art, onChat, onSettings, onOpen }: {
  ctx: AppContext;
  scene: OpenScene;
  busy: boolean;
  /** The cast character's portrait element, as the page draws it (the character card). */
  art: JSX.Element;
  onChat(chat: Chat): void;
  /** The scene after a loadout apply or undo, and the units it wrote: the page re-reads the Props and World it shows. */
  onSettings(next: OpenScene, units: readonly LoadoutUnit[]): void;
  /** Opens another wing by id (the Active Preset card opens Prompting). */
  onOpen(wing: string): void;
}): JSX.Element {
  const chat = scene.chat;
  const preset = useBoothPreset(ctx, chat.preset?.id ?? null);
  const models = useSceneModels(ctx, chat, onChat);
  const [note, setNote] = useState<string | null>(null);
  const [loreKey, setLoreKey] = useState(0);
  const [propsTick, setPropsTick] = useState(0);
  const directorOn = useDirectorOn(ctx, chat.id, propsTick);
  const own = useScenePresetOwn(ctx, chat, onChat, setNote);
  return (
    <div className="wbody bth" data-part="scene.booth">
      <div className="pp-top bth-top">
        <header className="hero">
          <span className="hi"><Ic name="mdi:tune" size={20} /></span>
          <div><div className="eb">Scene control surface</div><h2>Control <em>Booth</em></h2>
            <p>Fast scene setup: cast, preset, model choice, generation, lore links, and loadouts. Optional systems live in Props.</p></div>
        </header>
        {busy && <p className="bth-note" role="status">A reply is being written. Changes apply from the next reply.</p>}
        <div className="bth-map" data-part="scene.booth.status" role="group" aria-label="Current scene setup">
          <div><small>Preset</small><b>{presetTile(chat, preset)}</b></div>
          <div><small>Narrator</small><b>{chat.connection ? models.nameOf(chat.connection) : "Unset"}</b></div>
          <div><small>Story Director</small><b>{directorOn ? "On" : "Off"}</b></div>
        </div>
        <LoadoutBar ctx={ctx} scene={scene} busy={busy} onSettings={(next, units) => { if (units.includes("lore")) setLoreKey((n) => n + 1); onSettings(next, units); }} />
      </div>
      <BoothNavigator ctx={ctx} scene={scene} art={art} />
      <BoothPresetCard chat={chat} preset={preset} own={own} onOpen={() => onOpen("prompting")} />
      {note && <p className="bth-note warn" role="alert">{note}</p>}
      <BoothReadout ctx={ctx} scene={scene} />
      <BoothLoreRow key={loreKey} ctx={ctx} chatId={chat.id} />
      <BoothModelRow ctx={ctx} chat={chat} models={models} />
      <BoothGeneration chat={chat} preset={preset} own={own} windowTokens={chat.connection ? models.windowOf(chat.connection) : undefined} />
      <BoothSummaryRow ctx={ctx} chat={chat} onOpen={() => onOpen("context")} />
      <section className="bth-sec" data-part="scene.booth.runtime">
        <h3>Runtime Setup</h3>
        <ToolAccessRows ctx={ctx} chat={chat} onChanged={onChat} />
        <LastAsUserRow ctx={ctx} chat={chat} onChanged={onChat} />
      </section>
      <DirectorBooth ctx={ctx} chat={chat} busy={busy} onProps={() => { setPropsTick((n) => n + 1); onSettings(scene, ["props"]); }} />
    </div>
  );
}

/**
 * Narrator Tool Access and Max tool rounds (RoleCall's Runtime Setup, QuickPlayPanel.tsx:2101-2149; `stageSettings.agentLoopEnabled` and
 * `agentLoopMaxTurns`, clamped 1 to 20): the scene's own prompting settings (ChatStore rule 37), read by the turn (turn-loop rule 18). Off means the
 * writing model receives no tools. The rounds box shows only while access is on, as in RoleCall, and is clamped on the way in.
 */
function ToolAccessRows({ ctx, chat, onChanged }: { ctx: AppContext; chat: Chat; onChanged(chat: Chat): void }): JSX.Element {
  const saved = chat.prompting?.toolAccess === true;
  const [asked, setAsked] = useState<boolean | null>(null);
  const on = asked ?? saved;
  const write = async (patch: { toolAccess?: boolean; toolRounds?: number }, what: string): Promise<void> => {
    try {
      onChanged(await ctx.api.setScenePrompting(chat.id, patch));
    } catch (e) {
      ctx.setStatus(`${what} could not be saved: ${toErrorMessage(e)}`);
    }
  };
  const flip = async (): Promise<void> => {
    setAsked(!on);
    await write({ toolAccess: !on }, "Narrator Tool Access");
    setAsked(null);
  };
  return (
    <>
      <div {...protect("narrator-tools", "prop-row")} style={{ "--tone": "var(--stage-ok)" } as CSSProperties}>
        <span className="prop-ic"><Ic name="mdi:tune-vertical" size={20} /></span>
        <div><b>Narrator Tool Access</b><small>Off means the writing model receives no tools. Director and Compendium helpers still work separately.</small></div>
        <Toggle size="sm" tone="var(--tone)" on={on} aria-label={`${on ? "Turn off" : "Turn on"} narrator tool access`} onChange={() => void flip()} />
      </div>
      {on && (
        <div {...protect("narrator-tools", "prop-row")} style={{ "--tone": "var(--stage-ok)" } as CSSProperties}>
          <span className="prop-ic" />
          <div><b>Max tool rounds</b></div>
          <span><LoreNum label="Max tool rounds" className="bth-num" value={chat.prompting?.toolRounds ?? TOOL_ROUNDS_DEFAULT} fallback={TOOL_ROUNDS_DEFAULT} min={TOOL_ROUNDS_MIN} max={TOOL_ROUNDS_MAX} onChange={(n) => void write({ toolRounds: Math.min(TOOL_ROUNDS_MAX, Math.max(TOOL_ROUNDS_MIN, n)) }, "Max tool rounds")} /> rounds</span>
        </div>
      )}
    </>
  );
}
