/**
 * What the model is sent after the Cast wing changes who the person plays: casting another persona, or saving a wrapper edit, changes the
 * very next request (loadTurn reads the scene's frozen persona, assemble() builds the request from it), and nothing of the old persona stays.
 */
import { describe, expect, test } from "bun:test";
import { assemble } from "../core/assembly/assemble";
import { memoryChatStore } from "../stage/store/chat-store";
import type { SettingsStoreLike, StudioStoreLike } from "./contracts";
import { changeScenePersona, saveSceneMember } from "./scene-cast";
import { loadTurn } from "./scene-turn-load";
import { sendToScene, startScene } from "./scenes";

const character = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: { firstMessage: "Evening." }, examples: {}, media: {}, attribution: {}, discovery: {} } };
const persona = (id: string, name: string, wrapper: string) => ({ kind: "persona", id, body: { name, content: "", sections: { personality: `${name} is wry.` }, chatInjection: { position: "character", wrapper } } });

async function rig() {
  const library = new Map<string, { entity: unknown; version: number }>([
    ["character:vera", { entity: character, version: 1 }],
    ["persona:nuit", { entity: persona("nuit", "Nuit", "Nuit's wrapper:"), version: 2 }],
    ["persona:corvin", { entity: persona("corvin", "Corvin", "Corvin's wrapper:"), version: 1 }],
  ]);
  const studio = {
    readVersioned: async (kind: string, id: string) => library.get(`${kind}:${id}`) ?? null,
    summary: async (kind: string, id: string) => (library.has(`${kind}:${id}`) ? { version: library.get(`${kind}:${id}`)!.version } : null),
  } as unknown as StudioStoreLike;
  const settings = { read: async () => ({ "persona.default": "nuit" }) } as unknown as SettingsStoreLike;
  const chats = memoryChatStore();
  const chat = await startScene(chats, studio, settings, "vera");
  await sendToScene(chats, studio, { chatId: chat.id, content: "Hello", greetingIndex: 0, expectedVersion: 1 });
  /** The request the next turn would send, built the way the turn loop builds it. */
  const request = async (): Promise<string> => {
    const turn = (await loadTurn(chats, chat.id, "reply", async () => null, async () => null))!;
    const { character, persona, history, current, localVariables } = turn;
    return assemble({ character, ...(persona ? { persona } : {}), history, current, localVariables, globalVariables: new Map(), now: 0, randomSeed: 1 }).messages.map((m) => m.content).join("\n---\n");
  };
  return { chats, studio, library, chat, request };
}

describe("the next request after the Cast wing acts", () => {
  test("casting another persona sends that persona and its wrapper, and none of the old one", async () => {
    const { chats, studio, chat, request } = await rig();
    const before = await request();
    expect(before).toContain("Nuit's wrapper:\n<persona name=\"Nuit\">");
    await changeScenePersona(chats, studio, { chatId: chat.id, personaId: "corvin" });
    const after = await request();
    expect(after).toContain("Corvin's wrapper:\n<persona name=\"Corvin\">");
    expect(after).not.toContain("Nuit");
  });

  test("clearing the role sends no persona at all", async () => {
    const { chats, studio, chat, request } = await rig();
    await changeScenePersona(chats, studio, { chatId: chat.id, personaId: null });
    expect(await request()).not.toContain("<persona");
  });

  test("saving an edited wrapper moves the scene onto it, and the next request carries it", async () => {
    const { chats, studio, library, chat, request } = await rig();
    await saveSceneMember(chats, studio, {
      chatId: chat.id, kind: "persona",
      save: async () => { library.set("persona:nuit", { entity: persona("nuit", "Nuit", "Edited wrapper:"), version: 3 }); return { status: "saved" as const, revision: "r", summary: { id: "nuit", kind: "persona", name: "Nuit", version: 3 } as never }; },
    });
    const after = await request();
    expect(after).toContain("Edited wrapper:\n<persona name=\"Nuit\">");
    expect(after).not.toContain("Nuit's wrapper:");
  });
});
