/**
 * A character's starting setup (messenger backlog 23, D6): preset, samplers, backdrop and Story Director saved per character become a NEW scene's own settings when it starts, and only then.
 * A scene started before keeps what it has, and a default that points at something deleted leaves that part off, says so, and never stops the scene from starting.
 */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import { DIRECTOR_PROP_ID } from "../core/director/settings";
import type { SettingsStoreLike, StudioStoreLike } from "./contracts";
import { CHARACTER_DEFAULTS_PREF, characterDefaultsOf, withCharacterDefaults } from "./scene-character-defaults";
import { startScene, startSceneWithNotes } from "./scenes";

const body = { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} };
const library = (have: string[]): StudioStoreLike => ({
  readVersioned: async (kind: string, id: string) => (have.includes(`${kind}:${id}`) ? { entity: { kind, id, body }, version: 1 } : null),
}) as unknown as StudioStoreLike;
const settingsWith = (map: unknown): SettingsStoreLike => ({ read: async () => (map === undefined ? {} : { [CHARACTER_DEFAULTS_PREF]: map }) }) as unknown as SettingsStoreLike;
const ALL = ["character:vera", "preset:cozy", "pack:rooms"];
const FULL = { presetId: "cozy", presetKind: "preset", samplers: { temperature: 0.7 }, backdrop: { pack: "rooms", item: "attic", dim: 0.4 }, director: true };

describe("startScene: character defaults", () => {
  test("a new scene picks the preset, samplers, backdrop and Story Director saved for its character", async () => {
    const chats = memoryChatStore();
    const { chat, notes } = await startSceneWithNotes(chats, library(ALL), settingsWith({ vera: FULL }), "vera");
    expect(notes).toEqual([]);
    const stored = await chats.getChat(chat.id);
    expect(stored?.preset).toEqual({ kind: "preset", id: "cozy", toggles: {}, samplers: { temperature: 0.7 } });
    expect(stored?.backdrop).toEqual({ pack: "rooms", item: "attic", dim: 0.4 });
    expect(stored?.props).toEqual({ on: [DIRECTOR_PROP_ID] });
  });
  test("another character's defaults are not used, and no defaults leaves the scene as it was", async () => {
    const chats = memoryChatStore();
    const chat = await startScene(chats, library(ALL), settingsWith({ other: FULL }), "vera");
    expect(chat.preset).toBeUndefined();
    expect(chat.backdrop).toBeUndefined();
    expect(chat.props).toBeUndefined();
    expect((await startScene(chats, library(ALL), settingsWith(undefined), "vera")).preset).toBeUndefined();
  });
  test("a scene already started is untouched when the defaults change or are applied to a later one", async () => {
    const chats = memoryChatStore();
    const first = await startScene(chats, library(ALL), settingsWith(undefined), "vera");
    await startScene(chats, library(ALL), settingsWith({ vera: FULL }), "vera");
    const stored = await chats.getChat(first.id);
    expect(stored?.preset).toBeUndefined();
    expect(stored?.backdrop).toBeUndefined();
    expect(stored?.props).toBeUndefined();
    const second = await startScene(chats, library(ALL), settingsWith({ vera: FULL }), "vera");
    await startScene(chats, library(ALL), settingsWith({ vera: { presetId: "cozy", presetKind: "preset", samplers: { temperature: 1.1 } } }), "vera");
    expect((await chats.getChat(second.id))?.preset?.samplers).toEqual({ temperature: 0.7 });
  });
  test("a default preset that was deleted falls back to none, says so, and still applies the rest", async () => {
    const chats = memoryChatStore();
    const { chat, notes } = await startSceneWithNotes(chats, library(["character:vera", "pack:rooms"]), settingsWith({ vera: FULL }), "vera");
    const stored = await chats.getChat(chat.id);
    expect(stored?.title).toBe("Vera");
    expect(stored?.preset).toBeUndefined();
    expect(stored?.backdrop).toEqual({ pack: "rooms", item: "attic", dim: 0.4 });
    expect(stored?.props).toEqual({ on: [DIRECTOR_PROP_ID] });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("preset");
    expect(notes[0]).toContain("Vera");
  });
  test("a default backdrop whose pack was deleted is left off with a note", async () => {
    const { chat, notes } = await startSceneWithNotes(memoryChatStore(), library(["character:vera", "preset:cozy"]), settingsWith({ vera: FULL }), "vera");
    expect(chat.backdrop).toBeUndefined();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("backdrop");
  });
  test("defaults that cannot be read leave that part off with a note and never stop the scene", async () => {
    for (const bad of ["x", 7, [1], { vera: "x" }, { vera: { presetId: 5 } }, { vera: { backdrop: { pack: "" } } }, { vera: { director: "yes" } }, { vera: { presetId: "cozy", samplers: { temperature: "hot" } } }]) {
      const { chat, notes } = await startSceneWithNotes(memoryChatStore(), library(ALL), settingsWith(bad), "vera");
      expect(chat.title).toBe("Vera");
      if (typeof bad === "object" && !Array.isArray(bad) && "vera" in bad) expect(notes.length).toBeGreaterThan(0);
    }
  });
});

describe("characterDefaultsOf and withCharacterDefaults", () => {
  test("reads each valid field and reports each invalid one, keeping the valid ones", () => {
    const read = characterDefaultsOf({ vera: { ...FULL, director: 3 } }, "vera");
    expect(read.defaults).toEqual({ presetId: "cozy", presetKind: "preset", samplers: { temperature: 0.7 }, backdrop: { pack: "rooms", item: "attic", dim: 0.4 } });
    expect(read.problems).toEqual(["director"]);
  });
  test("a write changes only that character and keeps every other entry and unknown field as authored", () => {
    const raw = { vera: { presetId: "a", future: { x: 1 } }, other: "kept as is" };
    const next = withCharacterDefaults(raw, "vera", { presetId: "b", director: true });
    expect(next).toEqual({ vera: { presetId: "b", director: true, future: { x: 1 } }, other: "kept as is" });
    expect(raw.vera.presetId).toBe("a");
    expect(withCharacterDefaults(next, "vera", { presetId: null, director: null })).toEqual({ vera: { future: { x: 1 } }, other: "kept as is" });
    expect(withCharacterDefaults({ vera: { presetId: "a" } }, "vera", { presetId: null })).toEqual({});
  });
});
