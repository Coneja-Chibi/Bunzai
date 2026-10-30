/** Desktop and terminal composition of the reusable engine with the current library's readers and background jobs. */
import { createRoleplayCore } from "../rp-core";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import type { ReadPreset } from "../studio/scene-turn-load";
import type { ReadLorebook } from "../studio/scene-lore";
import type { CompendiumDeps } from "../studio/compendium-deps";
import { connect } from "../kit/providers/scene-connect";
import { narratorTools } from "../studio/library-tools";
import { finalCutBanksOf } from "../studio/final-cut-library";
import { onTurnEvent } from "../studio/compendium-hooks";
import { summarizeAfter } from "../studio/scene-summary";
import { sceneReaders } from "./server-scene-readers";
import { sceneRuntimeFor } from "./server-scene-runtime";

export function createSceneCore(chats: ChatStore, state: StateStore, readPreset: ReadPreset, readLorebook: ReadLorebook, studio?: StudioStoreLike, settings?: SettingsStoreLike, compendium?: CompendiumDeps | null) {
  const readLibrary = studio ? (kind: string, id: string) => studio.read(kind, id) : undefined;
  return createRoleplayCore({
    chats, state, connect, readPreset, readLorebook, readLibrary,
    narratorTools: narratorTools(readLibrary), finalCutBanks: () => finalCutBanksOf(state),
    ...sceneReaders(studio, settings), now: Date.now, randomSeed: () => Math.floor(Math.random() * 2 ** 31),
    afterEvent: async (input, event) => {
      const filing = compendium ? onTurnEvent(compendium, input.chatId, input.kind, event) : Promise.resolve();
      const summary = event.type === "done" ? summarizeAfter({ chats, connect, readLibrary }, input.chatId, input.kind, event.message) : Promise.resolve();
      await Promise.all([filing, summary]);
    },
  }, sceneRuntimeFor(chats));
}
