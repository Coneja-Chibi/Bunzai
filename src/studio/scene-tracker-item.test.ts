/**
 * Generate and Refresh for a tracker item on a scripted provider (RoleCall generate-tracker-item): the scene's model is asked once for one JSON item built from the
 * last messages, a bad answer gets one repair, and nothing is ever written to the scene. The answer is a proposal the panel shows for the person to accept.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";

import { compendiumRig } from "./fake-compendium-rig";
import { proposeTrackerItem } from "./scene-tracker-item";

const sword = JSON.stringify({ name: "Fire Sword", description: "Hot.", category: "weapon", rarity: "rare", quantity: 1, stats: [{ name: "Attack", value: 5 }], effects: [], value: 90 });
const rig = () => compendiumRig(null);
const ask = (chatId: string, over: Record<string, unknown> = {}) => ({ chatId, module: "inventory" as const, action: "generate" as const, itemName: "Fire Sword", ...over });

describe("proposeTrackerItem", () => {
  test("asks the scene's model once, from the last messages, and returns the item without writing anything", async () => {
    const r = await rig();
    r.script.push(sword);
    const before = JSON.stringify(await r.chats.getChat(r.chat.id));
    const got = await proposeTrackerItem(r.deps, ask(r.chat.id, { userGuide: "a legendary fire sword" }));
    expect(got).toEqual({ item: { name: "Fire Sword", description: "Hot.", category: "weapon", rarity: "rare", quantity: 1, stats: [{ name: "Attack", value: 5 }], effects: [], value: 90 } });
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0]!.model).toBe("vera-1");
    expect(r.requests[0]!.options).toMatchObject({ temperature: 0.3, max_tokens: 2000 });
    const [system, user] = r.requests[0]!.messages;
    expect(system!.content).toContain("precise JSON generator");
    expect(user!.content).toContain("Wolfman howls at the lamp.");
    expect(user!.content).toContain('User guidance: "a legendary fire sword"');
    expect(JSON.stringify(await r.chats.getChat(r.chat.id))).toBe(before);
  });
  test("a refresh sends the item it was given", async () => {
    const r = await rig();
    r.script.push(sword);
    await proposeTrackerItem(r.deps, { chatId: r.chat.id, module: "inventory", action: "refresh", existing: { name: "Old Blade" } });
    expect(r.requests[0]!.messages[1]!.content).toContain('"name": "Old Blade"');
  });
  test("a fenced answer is read; a bad one gets exactly one repair that names the problem", async () => {
    const r = await rig();
    r.script.push("Sure! Here you go", "```json\n" + sword + "\n```");
    expect((await proposeTrackerItem(r.deps, ask(r.chat.id))).item).toMatchObject({ name: "Fire Sword" });
    expect(r.requests).toHaveLength(2);
    expect(r.requests[1]!.messages[1]!.content).toContain("could not be used (the answer is not a JSON object)");
  });
  test("an answer that stays unreadable is an error with a reason, never a made-up item", async () => {
    const r = await rig();
    r.script.push("no", '{"description":"nameless"}');
    const e = await proposeTrackerItem(r.deps, ask(r.chat.id)).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(StudioConflictError);
    expect(String(e.message)).toContain("could not be read");
    expect(r.requests).toHaveLength(2);
  });
  test("a provider failure surfaces as it is", async () => {
    const r = await rig();
    r.script.push(new Error("down"));
    await expect(proposeTrackerItem(r.deps, ask(r.chat.id))).rejects.toThrow("down");
  });
  test("a scene that is gone, one without a connection, a module that generates nothing and a request without a name are refused before any model call", async () => {
    const r = await rig();
    await expect(proposeTrackerItem(r.deps, ask("nope"))).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(proposeTrackerItem(r.deps, ask(r.chat.id, { module: "resources" }))).rejects.toBeInstanceOf(StudioValidationError);
    await expect(proposeTrackerItem(r.deps, ask(r.chat.id, { itemName: "  " }))).rejects.toBeInstanceOf(StudioValidationError);
    await expect(proposeTrackerItem(r.deps, { chatId: r.chat.id, module: "inventory", action: "refresh" })).rejects.toBeInstanceOf(StudioValidationError);
    await r.chats.setConnection(r.chat.id, null);
    await expect(proposeTrackerItem(r.deps, ask(r.chat.id))).rejects.toBeInstanceOf(StudioConflictError);
    expect(r.requests).toHaveLength(0);
  });
});
