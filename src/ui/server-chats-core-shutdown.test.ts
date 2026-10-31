/** Library shutdown cancels a core review gate and awaits the engine's journal work. */
import { afterEach, expect, test } from "bun:test";
import { saveProvider } from "../kit/providers/vault";
import { libraryFor } from "../studio/library-content";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { closeSceneRuntime, sceneRuntimeFor } from "./server-scene-runtime";

afterEach(cleanupChatRouteRigs);
test("closing a library stops an external core review wait and drains its owned work", async () => {
  const provider = await saveProvider({ kind: "local", name: "Review fixture", model: "test", baseURL: "http://127.0.0.1:9/v1" }, { passphrase: "core-shutdown-test" });
  const rig = await chatRouteRig({ core: true });
  await rig.store.save(vera);
  const chat = await (await rig.post("/api/chats/start", { characterId: "vera" })).json() as { id: string };
  const sent = await (await rig.post("/api/chats/send", { chatId: chat.id, content: "Hello", greetingIndex: 0, expectedVersion: 1 })).json() as { branchVersion: number };
  await rig.post("/api/chats/connection", { chatId: chat.id, connection: { id: provider.id, model: "test" } });
  const response = await rig.post("/api/chats/turn", { chatId: chat.id, kind: "reply", expectedVersion: sent.branchVersion, inspect: true });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  let wire = "";
  while (!wire.includes("event: review")) {
    const frame = await reader.read();
    if (frame.done) throw new Error(`core never reached review: ${wire}`);
    wire += new TextDecoder().decode(frame.value);
  }
  const chats = libraryFor(rig.store.studioPath())!.chats;
  const closing = closeSceneRuntime(chats);
  while (true) { const frame = await reader.read(); if (frame.done) break; wire += new TextDecoder().decode(frame.value); }
  await closing;
  expect(wire).toContain("event: stopped");
  expect(sceneRuntimeFor(chats).closed).toBe(true);
  expect(sceneRuntimeFor(chats).tasks.size).toBe(0);
});
