/**
 * The Control Booth as the Messenger's side panel (approved wireframe messenger-discord/panels.html section 6a): the scene readout, the narrator model with its fallback, the active
 * preset, the lorebooks, the narrator card, the AI context summary, Change character, and the busy note, in that order. Every row is the Full Chat Booth's own module (booth-*.tsx, the
 * Story Director's DirectorBooth, ToolAccessRows) with its hooks and writers, so a change here is the change the Booth would write and nothing keeps a copy. The rows that open another
 * panel go through the shell's `open`: Generation, Lorebooks and Memory.
 */
import { useState, type JSX } from "react";
import { Button } from "../../../../../components/button";
import { BoothLoreRow } from "../../../booth-lore-row";
import { BoothModelRow } from "../../../booth-model-row";
import { BoothNavigator } from "../../../booth-navigator";
import { BoothPresetCard } from "../../../booth-preset-row";
import { BoothReadout } from "../../../booth-readout";
import { BoothSummaryRow } from "../../../booth-summary-row";
import { LoadoutBar } from "../../../loadout/loadout-bar";
import { LastAsUserRow } from "../../../scene-last-as-user-row";
import { BoothGeneration } from "../../../booth-preset-row";
import { ToolAccessRows, presetTile } from "../../../scene-booth-wing";
import { DirectorBooth } from "../../../props/story-director/director-booth";
import { useDirectorOn } from "../../../use-director-on";
import { useBoothPreset } from "../../../use-booth-preset";
import { useSceneModels } from "../../../use-scene-models";
import { useScenePresetOwn } from "../../../use-scene-preset-own";
import { onBoothSettings, onChatOf, type WingArgs } from "../../wing-props";

export function MessengerBooth({ args, open }: { args: WingArgs; open(programId: string): void }): JSX.Element {
  const { ctx, scene, busy } = args;
  const chat = scene.chat;
  const onChat = onChatOf(args);
  const preset = useBoothPreset(ctx, chat.preset ?? null);
  const models = useSceneModels(ctx, chat, onChat);
  const [note, setNote] = useState<string | null>(null);
  const own = useScenePresetOwn(ctx, chat, onChat, setNote);
  const [propsTick, setPropsTick] = useState(0);
  const [loreKey, setLoreKey] = useState(0);
  const directorOn = useDirectorOn(ctx, chat.id, propsTick);
  const settings = onBoothSettings(args);
  return (
    <div className="msn-bth" data-part="scene.messenger.booth">
      <BoothReadout ctx={ctx} scene={scene} />
      <BoothModelRow ctx={ctx} chat={chat} models={models} />
      <BoothPresetCard chat={chat} preset={preset} own={own} onOpen={() => open("prompts")} />
      {note && <p className="bth-note warn" role="alert">{note}</p>}
      <BoothLoreRow key={loreKey} ctx={ctx} chatId={chat.id} />
      <div className="msn-bth-open" data-part="scene.messenger.booth.lore-open"><Button variant="quiet" size="sm" icon="lucide:chevron-right" onClick={() => open("lorebook")}>Open lorebooks</Button></div>
      <DirectorBooth ctx={ctx} chat={chat} busy={busy} onProps={() => { setPropsTick((n) => n + 1); args.propsState.reload(); }} />
      <section className="bth-sec" data-part="scene.messenger.booth.tools"><ToolAccessRows ctx={ctx} chat={chat} onChanged={onChat} /></section>
      <BoothSummaryRow ctx={ctx} chat={chat} onOpen={() => open("memory")} />
      <BoothNavigator ctx={ctx} scene={scene} art={args.charArt} />
      {busy && <p className="bth-note" role="status" data-part="scene.messenger.booth.busy">A reply is being written. Changes apply from the next reply.</p>}
      <div className="bth-map" data-part="scene.booth.status" role="group" aria-label="Current scene setup">
        <div><small>Preset</small><b>{presetTile(chat, preset)}</b></div>
        <div><small>Narrator</small><b>{chat.connection ? models.nameOf(chat.connection) : "Unset"}</b></div>
        <div><small>Story Director</small><b>{directorOn ? "On" : "Off"}</b></div>
      </div>
      <LoadoutBar ctx={ctx} scene={scene} busy={busy} onSettings={(next, units) => { if (units.includes("lore")) setLoreKey((n) => n + 1); settings(next, units); }} />
      <BoothGeneration chat={chat} preset={preset} own={own} windowTokens={chat.connection ? models.windowOf(chat.connection) : undefined} />
      <section className="bth-sec" data-part="scene.messenger.booth.runtime"><LastAsUserRow ctx={ctx} chat={chat} onChanged={onChat} /></section>
    </div>
  );
}
