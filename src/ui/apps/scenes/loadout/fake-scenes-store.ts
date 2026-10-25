/**
 * A stand-in for the scenes api that holds one scene and one loadout library in memory (tests only): the engine's fake
 * (fake-loadout-api.ts) for the settings and receipts, with each setter answering the chat as the store would, the
 * loadout library with its soft delete and 100 cap, and the latest open receipt. A write changes what the next read answers.
 */
import { LOADOUT_CAP } from "../../../../core/loadout-panels";
import type { Chat, JsonValue } from "../../../../stage/contracts/chat-store";
import type { LoadoutRecord } from "../../../../studio/loadout-record";
import type { OpenScene } from "../../../../studio/scenes";
import type { SceneSettings } from "../../../app-contract-scenes";
import { fakeLoadoutApi, type FakeLoadoutApi } from "./fake-loadout-api";

export interface FakeScenesStore extends FakeLoadoutApi {
  loadouts: LoadoutRecord[];
  chatOf(): Chat;
  sceneOf(): OpenScene;
  /** Everything the Booth's api needs beyond a stand-in's own members. */
  scenesApi: Record<string, unknown>;
}

export function fakeScenesStore(settings: SceneSettings = { persona: null }): FakeScenesStore {
  const fake = fakeLoadoutApi(settings) as FakeScenesStore;
  const cast = { character: { id: "c1", version: 1, name: "Char" } } as Chat["cast"];
  fake.loadouts = [];
  fake.chatOf = () => {
    const { persona: _p, ...rest } = fake.scene;
    void _p;
    return { id: "chat1", title: "Scene", cast, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, ...rest } as Chat;
  };
  fake.sceneOf = () => ({ chat: fake.chatOf(), messages: [], messageCount: 0, snapshot: {} }) as unknown as OpenScene;
  const answer = <A extends unknown[]>(write: (...a: A) => Promise<unknown>, read: () => unknown) => async (...a: A) => {
    await write(...a);
    return read();
  };
  const a = fake.api;
  fake.scenesApi = {
    ...a,
    setSceneConnection: answer(a.setSceneConnection, fake.chatOf),
    setScenePreset: answer(a.setScenePreset, fake.chatOf),
    setScenePrompting: answer(a.setScenePrompting, fake.chatOf),
    setSceneRegex: answer(a.setSceneRegex, fake.chatOf),
    setSceneBackdrop: answer(a.setSceneBackdrop, fake.chatOf),
    setSceneLore: answer(a.setSceneLore, () => ({ books: [], lastTurn: null })),
    setSceneProps: answer(a.setSceneProps, () => ({ on: fake.scene.props?.on ?? [] })),
    editScene: answer(a.editScene, fake.sceneOf),
    listLoadouts: async (removed?: boolean) => fake.loadouts.filter((l) => (l.deletedAt !== undefined) === !!removed).map((l) => structuredClone(l)),
    saveLoadout: async (input: { id?: string; name: string; values: Record<string, JsonValue> }) => {
      fake.calls.push("loadout-save");
      const found = fake.loadouts.find((l) => l.id === input.id);
      if (!found && fake.loadouts.filter((l) => l.deletedAt === undefined).length >= LOADOUT_CAP) throw new Error(`You have ${LOADOUT_CAP} loadouts. Delete one first.`);
      const record: LoadoutRecord = { id: input.id ?? `l${fake.loadouts.length + 1}`, name: input.name, createdAt: fake.clock.now, updatedAt: fake.clock.now, panels: Object.keys(input.values), values: structuredClone(input.values) };
      if (found) fake.loadouts[fake.loadouts.indexOf(found)] = { ...record, createdAt: found.createdAt };
      else fake.loadouts.push(record);
      return record;
    },
    deleteLoadout: async (id: string) => {
      const found = fake.loadouts.find((l) => l.id === id);
      if (found) found.deletedAt = fake.clock.now;
      return { deleted: !!found };
    },
    restoreLoadout: async (id: string) => {
      const found = fake.loadouts.find((l) => l.id === id)!;
      delete found.deletedAt;
      return found;
    },
    latestLoadoutReceipt: async (chatId: string) => [...fake.receipts.values()].filter((r) => r.chatId === chatId && r.undoneAt === undefined && fake.clock.now < r.undoUntil).at(-1) ?? null,
  };
  return fake;
}
