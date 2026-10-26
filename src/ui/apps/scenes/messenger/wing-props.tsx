/**
 * Every wing's panel for the open scene, in one place that both chat layouts call: the Full Chat wing slots (scene-page.tsx) and the Messenger programs (messenger-chrome.tsx).
 * Lifted out of the scene page unchanged; `tab` is the one new thing, the tab a Messenger program opens its wing on (scene-wings.tsx `WingPanel`).
 */
import type { ComponentProps, Dispatch, JSX, SetStateAction } from "react";
import type { AppContext } from "../../../app-contract";
import type { PresetBody } from "../../../../entities/preset/schema";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import type { CardState } from "../scene-card";
import { sceneColors } from "../scene-accents";
import type { WingPanel } from "../scene-wings";
import type { StageOpenRequest } from "../use-stage-open";
import type { useSceneProps } from "../props/use-scene-props";
import type { SceneProp } from "../props/prop-contract";
import { CastWing } from "../scene-cast-wing";
import { BoothWing } from "../scene-booth-wing";
import { AiWing } from "../scene-ai-wing";
import { GenerationTab } from "../generation/generation-tab";
import { BackdropRow } from "../scene-backdrop-wing";
import { PromptingWing } from "../scene-prompting";
import { FinalCutWing } from "../scene-final-cut";
import { LoreWing } from "../scene-lore-wing";
import { CompendiumWithFiling } from "../compendium/compendium-mounts";
import { CompendiumSettingsTab } from "../compendium/tabs/settings";
import { AccessChip } from "../compendium/tabs/settings/access-chip";
import { loreTabMeta } from "../lore-core";
import { PropsWing, propsTabMeta } from "../props/props-wing";

/** What the panels read of the page and the ways they hand a change back to it. */
export interface WingArgs {
  ctx: AppContext;
  scene: OpenScene;
  busy: boolean;
  card: CardState | null;
  name: string;
  charArt: JSX.Element;
  /** Whether the character card carries a backdrop the scene's own one is set against. */
  cardPinned: boolean;
  presetBody: PresetBody | null;
  setPresetBody(body: PresetBody | null): void;
  loreBooks: SceneLoreBook[] | null;
  setLoreBooks(books: SceneLoreBook[] | null): void;
  registeredProps: readonly SceneProp[];
  propsState: ReturnType<typeof useSceneProps>;
  propsOn: readonly string[] | null;
  stageRequest: StageOpenRequest | null;
  setScene: Dispatch<SetStateAction<OpenScene | null>>;
  replaceScene(next: OpenScene): void;
  /** The app prefs are not reactive: a display switch re-renders the page by hand. */
  repaint(): void;
  onUpdate(): void;
  onRevert(): void;
  /** A panel asking for another wing (or null to close this one). */
  openWing(id: string | null): void;
}

export type WingPanels = Omit<ComponentProps<typeof WingPanel>, "id" | "tab" | "bare" | "single" | "resize">;

/** A panel's new chat, taken into the page's scene. */
export const onChatOf = (a: Pick<WingArgs, "setScene">) => (chat: Chat): void => a.setScene((s) => (s ? { ...s, chat } : s));

/** What a Booth loadout apply or undo hands back: the page takes the scene and re-reads the Props and World it shows. */
export const onBoothSettings = (a: WingArgs) => (next: OpenScene, units: readonly string[]): void => { a.replaceScene(next); if (units.includes("props")) a.propsState.reload(); if (units.includes("lore")) a.setLoreBooks(null); };

export function wingPanels(a: WingArgs, tab?: string, single = false): WingPanels {
  const { ctx, scene, busy, card, name, propsState, registeredProps } = a;
  const onChat = onChatOf(a);
  const initial = { ...(tab === undefined ? {} : { initialTab: tab }), ...(single ? { single } : {}) };
  return {
    castPanel: <CastWing ctx={ctx} scene={scene} busy={busy} card={card} onScene={a.replaceScene} onUpdate={a.onUpdate} onRevert={a.onRevert} {...initial} />,
    booth: <BoothWing ctx={ctx} scene={scene} busy={busy} art={a.charArt} onChat={onChat} onSettings={onBoothSettings(a)} onOpen={a.openWing} />,
    ai: <AiWing ctx={ctx} chat={scene.chat} onPicked={(chat) => a.setScene({ ...scene, chat })} onClose={() => a.openWing(null)} />,
    aiGeneration: <GenerationTab ctx={ctx} chat={scene.chat} onChat={onChat} />,
    prompting: { panel: <PromptingWing ctx={ctx} chat={scene.chat} presetBody={a.presetBody} onChanged={onChat} onBody={a.setPresetBody} {...initial} /> },
    world: { panel: <LoreWing ctx={ctx} chat={scene.chat} characterName={name} onLore={a.setLoreBooks} />, compendium: <CompendiumWithFiling ctx={ctx} chat={scene.chat} books={a.loreBooks} onChat={onChat} settings={(m) => <CompendiumSettingsTab ctx={ctx} chat={scene.chat} bookId={m.bookId} onChat={onChat} />} chip={(bookId, bookName) => <AccessChip ctx={ctx} chat={scene.chat} bookId={bookId} bookName={bookName} onChat={onChat} />} />, meta: loreTabMeta(a.loreBooks) },
    stage: { prefs: ctx.prefs, colors: sceneColors(scene), onSet: (key, value) => { ctx.prefs.set(key, value); a.repaint(); }, backdrop: <BackdropRow ctx={ctx} chat={scene.chat} cardPinned={a.cardPinned} onChat={onChat} />, host: { ctx, scene, propsOn: a.propsOn, request: a.stageRequest, onChat } },
    finalCut: { panel: <FinalCutWing ctx={ctx} chat={scene.chat} onChanged={onChat} {...initial} /> },
    context: { ctx, scene, onChat },
    props: { panel: <PropsWing list={registeredProps} load={propsState.load} onToggle={propsState.toggle} onRetry={propsState.reload} prefs={ctx.prefs} host={{ ctx, chat: scene.chat, onChat }} />, meta: propsTabMeta(registeredProps, propsState.load) },
  };
}
