/**
 * The scene's Compendium writer (use-scene-compendium.ts): showing the choices writes nothing, a change is one patch,
 * two quick changes reach the store in the order asked, and a refusal rejects without losing the next change.
 */
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatCompendiumPatch } from "../../../stage/contracts/chat-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { SceneCompendium } from "./use-scene-compendium";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => installed.reinstall());

const chatWith = (compendium?: Chat["compendium"]): Chat => ({ id: "c1", title: "Scene", cast: { character: { id: "x", version: 1, name: "X" } }, activeBranchId: "b", createdAt: 0, updatedAt: 0, snapshotVersion: 1, ...(compendium ? { compendium } : {}) }) as Chat;

async function mountHook(chat: Chat, setScene: (id: string, p: ChatCompendiumPatch) => Promise<Chat>, changed: Chat[]): Promise<() => SceneCompendium> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { useSceneCompendium } = await import("./use-scene-compendium");
  let latest!: SceneCompendium;
  const Probe = () => { latest = useSceneCompendium({ api: { setSceneCompendium: setScene } } as unknown as AppContext, chat, (c) => changed.push(c)); return null; };
  const host = dom.window.document.createElement("div");
  flushSync(() => createRoot(host).render(<Probe />));
  return () => latest;
}

test("showing the choices writes nothing, and an unsaved scene resolves to the defaults", async () => {
  const sent: ChatCompendiumPatch[] = [];
  const hook = await mountHook(chatWith(), async (_id, p) => { sent.push(p); return chatWith(); }, []);
  expect(sent).toEqual([]);
  expect(hook().saved).toBeUndefined();
  expect(hook().resolved).toMatchObject({ on: false, recall: { on: true, maxEntries: 10 } });
});

test("changes are sent one after another, in order, each answered chat handed back", async () => {
  const order: string[] = [];
  const changed: Chat[] = [];
  const hook = await mountHook(chatWith(), async (_id, p) => {
    order.push(`start ${JSON.stringify(p)}`);
    await new Promise((r) => setTimeout(r, p.on === true ? 30 : 0));
    order.push(`end ${JSON.stringify(p)}`);
    return chatWith(p as Chat["compendium"]);
  }, changed);
  await Promise.all([hook().patch({ on: true }), hook().patch({ language: "Latin" })]);
  expect(order).toEqual(['start {"on":true}', 'end {"on":true}', 'start {"language":"Latin"}', 'end {"language":"Latin"}']);
  expect(changed).toHaveLength(2);
});

test("a refused change rejects with the reason and the next one still goes", async () => {
  let calls = 0;
  const hook = await mountHook(chatWith(), async () => { if (calls++ === 0) throw new Error("recall.maxEntries is out of range"); return chatWith({ on: true }); }, []);
  await expect(hook().patch({ recall: { maxEntries: 99 } })).rejects.toThrow("out of range");
  await hook().patch({ on: true });
  expect(calls).toBe(2);
});
