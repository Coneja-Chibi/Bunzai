/**
 * Refresh from chat history for a whole tracker on a scripted provider (RoleCall initialize-trackers): the scene's model is asked once, from the window sliced once and the
 * tracker as it is, a bad answer gets one repair, and nothing is ever written to the scene. A failure never answers with defaults.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { stripComments } from "../../scripts/hooks/lib";
import { DEFAULT_INVENTORY, applyInventory, readInventory } from "../core/trackers/inventory";
import { parseTrackerData } from "../core/trackers";
import { StudioConflictError } from "./atomic-file";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { compendiumRig } from "./fake-compendium-rig";
import { proposeTrackerRefresh } from "./scene-tracker-refresh";
import { draftOnly } from "./scene-tracker-item";

const rig = () => compendiumRig(null);
const sword = (over: Record<string, unknown> = {}) => ({ name: "Fire Sword", description: "Hot.", category: "weapon", rarity: "rare", quantity: 1, ...over });
const answer = (...items: unknown[]) => JSON.stringify({ items, currency: 12 });
const ask = (chatId: string, module = "inventory" as const) => ({ chatId, module });
const refresh = (r: Awaited<ReturnType<typeof rig>>, ids = 0) => ({ ...r.deps, newId: () => `gen-${++ids}` });
const state = (r: Awaited<ReturnType<typeof rig>>) => r.chats.getChat(r.chat.id).then((c) => JSON.stringify(c));

describe("proposeTrackerRefresh", () => {
  test("asks the scene's model once, from the tracker as it is, and answers the proposal without writing anything", async () => {
    const r = await rig();
    await r.chats.setTracker(r.chat.id, "inventory", { data: applyInventory(DEFAULT_INVENTORY, { kind: "add", item: { name: "Old Key", description: "", category: "key", rarity: "common", quantity: 1 }, id: "k1", at: 1 }) as never });
    r.script.push(answer(sword()));
    const before = await state(r);
    const got = await proposeTrackerRefresh(refresh(r), ask(r.chat.id));
    expect(got.chatId).toBe(r.chat.id);
    expect(got.module).toBe("inventory");
    expect(parseTrackerData("inventory", got.proposed)).not.toBeNull();
    expect(readInventory(got.proposed).currency).toBe(12);
    expect(got.diff.added.map((c) => c.label)).toEqual(["Fire Sword"]);
    expect(got.diff.removed.map((c) => c.label)).toEqual(["Old Key"]);
    expect(got.skipped).toEqual([]);
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0]!.model).toBe("vera-1");
    expect(r.requests[0]!.options).toMatchObject({ temperature: 0.3, max_tokens: 4000 });
    const [system, user] = r.requests[0]!.messages;
    expect(system!.content).toContain("precise JSON generator");
    expect(user!.content).toContain("THE TRACKER NOW");
    expect(user!.content).toContain('"name": "Old Key"');
    expect(user!.content).not.toContain("k1");
    expect(await state(r)).toBe(before);
  });

  test("one entry that cannot be read is skipped and named in the proposal, and the answer still stands", async () => {
    const r = await rig();
    r.script.push(answer(sword(), 9));
    const got = await proposeTrackerRefresh(refresh(r), ask(r.chat.id));
    expect(got.diff.added.map((c) => c.label)).toEqual(["Fire Sword"]);
    expect(got.skipped).toEqual([{ name: "item 2", reason: expect.any(String) }]);
    expect(r.requests).toHaveLength(1);
  });

  test("the window is the twenty newest messages and the opening one, sliced once", async () => {
    const r = await rig();
    await r.chats.appendMessages(r.chat.activeBranchId, Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: `turn-${String(i).padStart(2, "0")}` })));
    r.script.push(answer());
    await proposeTrackerRefresh(refresh(r), ask(r.chat.id));
    const user = r.requests[0]!.messages[1]!.content as string;
    expect(user).toContain("Vera: Evening.");
    expect([...user.matchAll(/turn-\d\d/g)].map((m) => m[0])).toEqual(Array.from({ length: 20 }, (_, i) => `turn-${String(i + 5).padStart(2, "0")}`));
    expect(user).not.toContain("Who howls?");
    expect(user).not.toContain("turn-04");
  });

  test("a short scene shows its opening message once", async () => {
    const r = await rig();
    r.script.push(answer());
    await proposeTrackerRefresh(refresh(r), ask(r.chat.id));
    const user = r.requests[0]!.messages[1]!.content as string;
    expect(user.match(/Evening\./g)).toHaveLength(1);
    expect(user).toContain("Wolfman howls at the lamp.");
  });

  test("a bad answer gets exactly one repair that names the problem", async () => {
    const r = await rig();
    r.script.push("Sure! Here you go", "```json\n" + answer(sword()) + "\n```");
    const got = await proposeTrackerRefresh(refresh(r), ask(r.chat.id));
    expect(got.diff.added).toHaveLength(1);
    expect(r.requests).toHaveLength(2);
    expect(r.requests[1]!.messages[1]!.content).toContain("could not be used (the answer is not a JSON object)");
  });

  test("an answer that stays unreadable is an error with a reason, the tracker is untouched and no defaults are applied", async () => {
    const r = await rig();
    r.script.push("no", '{"hp": 1}');
    const before = await state(r);
    const e = await proposeTrackerRefresh(refresh(r), ask(r.chat.id)).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(StudioConflictError);
    expect(String(e.message)).toContain("could not be read");
    expect(r.requests).toHaveLength(2);
    expect(await state(r)).toBe(before);
  });

  test("a provider failure surfaces as it is and writes nothing", async () => {
    const r = await rig();
    r.script.push(new Error("down"));
    const before = await state(r);
    await expect(proposeTrackerRefresh(refresh(r), { chatId: r.chat.id, module: "resources" })).rejects.toThrow("down");
    expect(await state(r)).toBe(before);
    expect((await r.chats.getChat(r.chat.id))!.trackers?.resources).toBeUndefined();
  });

  test("Stats refreshes too, with the model's numbers and nothing from the defaults the model did not send", async () => {
    const r = await rig();
    r.script.push(JSON.stringify({ hp: 30, maxHp: 100 }));
    const got = await proposeTrackerRefresh(refresh(r), { chatId: r.chat.id, module: "resources" });
    expect(got.diff.changed.map((c) => [c.label, c.after])).toEqual([["HP", 30]]);
  });

  test("a scene that is gone, one without a connection, a scene with no messages, and trackers that do not refresh are refused before any model call", async () => {
    const r = await rig();
    await expect(proposeTrackerRefresh(refresh(r), ask("nope"))).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(proposeTrackerRefresh(refresh(r), { chatId: r.chat.id, module: "quests" })).rejects.toBeInstanceOf(StudioValidationError);
    await expect(proposeTrackerRefresh(refresh(r), { chatId: r.chat.id, module: "nope" as never })).rejects.toBeInstanceOf(StudioValidationError);
    await r.chats.setConnection(r.chat.id, null);
    await expect(proposeTrackerRefresh(refresh(r), ask(r.chat.id))).rejects.toBeInstanceOf(StudioConflictError);
    const empty = await r.chats.createChat({ title: "Empty", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } } } as never });
    await r.chats.setConnection(empty.id, { id: "conn", model: "vera-1" });
    await expect(proposeTrackerRefresh(refresh(r), ask(empty.id))).rejects.toThrow("no messages");
    expect(r.requests).toHaveLength(0);
  });
});

describe("the tier is read, not decorative", () => {
  test("a tracker action the table puts above draft refuses to run", () => {
    expect(() => draftOnly("tracker.refresh")).not.toThrow();
    expect(() => draftOnly("tracker.generate")).not.toThrow();
    expect(() => draftOnly("tracker.refresh", { "tracker.refresh": "write" })).toThrow(StudioValidationError);
    expect(() => draftOnly("tracker.generate", {})).toThrow(StudioValidationError);
  });
  test("Generate and Refresh each ask the table for their own action where they run", () => {
    const code = (f: string): string => stripComments(readFileSync(f, "utf8"));
    expect(code("src/studio/scene-tracker-item.ts")).toContain('draftOnly("tracker.generate")');
    expect(code("src/studio/scene-tracker-refresh.ts")).toContain('draftOnly("tracker.refresh")');
  });
});
