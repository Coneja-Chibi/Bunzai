/**
 * The Props trackers' state as the pages read and write it (tracker-state.ts, and its routes in ui/server-chats-tracker-state.ts): the read of every module's data and the update lines at the tip,
 * the person's write on the newest reply (several modules in one step, all or nothing), and every refusal with its sentence.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { trackerDeltas } from "../core/trackers";
import { DEFAULT_INVENTORY, applyInventory, readInventory } from "../core/trackers/inventory";
import { DEFAULT_RESOURCES, readResources } from "../core/trackers/resources";
import type { JsonValue } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { handleTrackerStateRoute, parseTrackerWrite } from "../ui/server-chats-tracker-state";
import { studioErr } from "../ui/server-security";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";

import { dataAt } from "./fake-director-rig";
import { readTrackerStates, undoTrackerUpdate, writeTrackerStates, type TrackerWriteInput } from "./tracker-state";

const now = () => 5_000;
const key = { name: "Rusty Key", description: "", category: "key" as const, rarity: "common" as const, quantity: 1 };
const withKey = (id: string) => applyInventory(DEFAULT_INVENTORY, { kind: "add", item: key, id, at: 1 });

async function rig() {
  const runtime = createTurnRuntime();
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
  const branch = chat.activeBranchId;
  await chats.appendMessage(branch, { role: "user", content: "hi" });
  const open = await chats.beginTurn(branch, { kind: "reply" });
  await chats.saveCheckpoint(open!.id, { content: "t" });
  const reply = (await chats.commitTurn(open!.id, { content: "t" }))!;
  const states = async () => (await readTrackerStates(chats, (await chats.getChat(chat.id))!, branch))!;
  const write = async (over: Partial<TrackerWriteInput> & Pick<TrackerWriteInput, "writes">) => {
    const at = await states();
    return writeTrackerStates(runtime, chats, { chatId: chat.id, branchId: branch, messageId: reply.id, expectedVersion: at.branchVersion, ...over }, now);
  };
  const data = (module: "resources" | "inventory") => dataAt(chats, branch, module);
  return { runtime, chats, chat, branch, reply, states, write, data };
}

describe("the read", () => {
  test("a take with nothing written has no data and no update, and names its tip and version", async () => {
    const r = await rig();
    expect(await r.states()).toMatchObject({ branchId: r.branch, tipId: r.reply.id, data: {}, updates: {} });
  });

  test("a module's data is its saved state over the defaults, and the update line is the last change the reply's version made on its own, with the data before and after", async () => {
    const r = await rig();
    const swipe = r.reply.swipes[r.reply.current]!.id;
    await r.chats.recordDeltas(r.branch, swipe, trackerDeltas("resources", undefined, { ...DEFAULT_RESOURCES, hp: 60 }, 9));
    const at = await r.states();
    expect(readResources(at.data["resources"]).hp).toBe(60);
    expect(at.updates["resources"]).toMatchObject({ messageId: r.reply.id, number: 2, at: 9 });
    expect(readResources(at.updates["resources"]!.before).hp).toBe(100);
    expect(readResources(at.updates["resources"]!.after).hp).toBe(60);
  });

  test("the person's own edit is not an update: it has no line", async () => {
    const r = await rig();
    await r.write({ writes: [{ module: "resources", data: { ...DEFAULT_RESOURCES, hp: 40 } as unknown as JsonValue }] });
    expect((await r.states()).updates).toEqual({});
  });
});

describe("the person's write", () => {
  test("writes the rows it changed on the newest reply, and answers the trackers as they now stand", async () => {
    const r = await rig();
    const done = await r.write({ writes: [{ module: "inventory", data: withKey("a") as unknown as JsonValue }] });
    expect(readInventory(done.data["inventory"]).items.map((i) => i.id)).toEqual(["a"]);
    const range = (await r.chats.sceneDeltas(r.branch, r.reply.id, r.reply.id, ["tracker."]))!.messages[0]!;
    expect(range.deltas.slice(range.personFrom).map((d) => d.path[0])).toEqual(["items:a"]);
  });

  test("several modules in one write are all or nothing: one that is not a state of its module keeps the others out", async () => {
    const r = await rig();
    await expect(r.write({ writes: [{ module: "inventory", data: withKey("a") as unknown as JsonValue }, { module: "resources", data: { hp: 1 } }] })).rejects.toBeInstanceOf(StudioValidationError);
    expect(await r.states()).toMatchObject({ data: {} });
    await r.write({ writes: [{ module: "inventory", data: withKey("a") as unknown as JsonValue }, { module: "resources", data: { ...DEFAULT_RESOURCES, hp: 40 } as unknown as JsonValue }] });
    expect(readInventory(await r.data("inventory")).items).toHaveLength(1);
    expect(readResources(await r.data("resources")).hp).toBe(40);
  });

  test("null clears a module back to its defaults, and a Storyboard (no state) cannot be written", async () => {
    const r = await rig();
    await r.write({ writes: [{ module: "resources", data: { ...DEFAULT_RESOURCES, hp: 40 } as unknown as JsonValue }] });
    await r.write({ writes: [{ module: "resources", data: null }] });
    expect(readResources(await r.data("resources")).hp).toBe(100);
    await expect(r.write({ writes: [{ module: "quests", data: {} }] })).rejects.toThrow("keeps no state");
  });

  test("a take that moved on, a message that is not the newest, a turn running and a scene or take that is gone are each refused with a sentence, changing nothing", async () => {
    const r = await rig();
    const stale = (await r.states()).branchVersion;
    await r.chats.appendMessage(r.branch, { role: "user", content: "more" });
    const writes = [{ module: "resources" as const, data: { ...DEFAULT_RESOURCES, hp: 40 } as unknown as JsonValue }];
    await expect(writeTrackerStates(r.runtime, r.chats, { chatId: r.chat.id, branchId: r.branch, messageId: r.reply.id, writes, expectedVersion: stale }, now)).rejects.toThrow("moved on");
    const open = await r.chats.beginTurn(r.branch, { kind: "reply" });
    await expect(writeTrackerStates(r.runtime, r.chats, { chatId: r.chat.id, branchId: r.branch, messageId: (await r.states()).tipId!, writes, expectedVersion: (await r.states()).branchVersion }, now)).resolves.toBeDefined();
    await r.chats.dropTurn(open!.id);
    await expect(writeTrackerStates(r.runtime, r.chats, { chatId: "nope", branchId: r.branch, messageId: r.reply.id, writes, expectedVersion: 1 }, now)).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(writeTrackerStates(r.runtime, r.chats, { chatId: r.chat.id, branchId: "nope", messageId: r.reply.id, writes, expectedVersion: 1 }, now)).rejects.toBeInstanceOf(StudioNotFoundError);
  });
});

describe("a write is the change from the data the panel computed it from", () => {
  const rows = (...ids: string[]) => ids.reduce((inv, id) => applyInventory(inv, { kind: "add", item: { ...key, name: id }, id, at: 1 }), DEFAULT_INVENTORY);
  const addAfterRead = async (r: Awaited<ReturnType<typeof rig>>) => {
    const read = (await r.states()).data["inventory"] ?? null;
    // Another writer (the Story Director's round) adds a row to this reply's version after the panel read.
    await r.chats.recordDeltas(r.branch, r.reply.swipes[r.reply.current]!.id, trackerDeltas("inventory", undefined, rows("rope"), 9));
    return read;
  };

  test("what another writer changed elsewhere meanwhile is kept: the person's change is only the rows and fields they changed", async () => {
    const r = await rig();
    const base = await addAfterRead(r);
    await r.write({ writes: [{ module: "inventory", base, data: { ...DEFAULT_INVENTORY, currency: 7 } as unknown as JsonValue }] });
    const inv = readInventory(await r.data("inventory"));
    expect([inv.currency, inv.items.map((i) => i.id)]).toEqual([7, ["rope"]]);
    const range = (await r.chats.sceneDeltas(r.branch, r.reply.id, r.reply.id, ["tracker."]))!.messages[0]!;
    expect(range.deltas.slice(range.personFrom).map((d) => d.path[0])).toEqual(["currency"]);
  });

  test("a write that names no base replaces what the take shows now, and so can take another writer's row out", async () => {
    const r = await rig();
    await addAfterRead(r);
    await r.write({ writes: [{ module: "inventory", data: { ...DEFAULT_INVENTORY, items: [] } as unknown as JsonValue }] });
    expect(readInventory(await r.data("inventory")).items).toEqual([]);
  });

  test("a write that names its base is refused, changing nothing, when another writer changed the very row it changes", async () => {
    const r = await rig();
    await addAfterRead(r);
    const swipe = r.reply.swipes[r.reply.current]!.id;
    await r.chats.recordDeltas(r.branch, swipe, trackerDeltas("inventory", rows("rope"), applyInventory(rows("rope"), { kind: "qty", id: "rope", delta: 4 }), 10));
    const moved = await r.write({ writes: [{ module: "inventory", base: rows("rope") as unknown as JsonValue, data: applyInventory(rows("rope"), { kind: "qty", id: "rope", delta: 2 }) as unknown as JsonValue }] }).then(() => null, (e: unknown) => e);
    expect(moved).toBeInstanceOf(StudioConflictError);
    expect(readInventory(await r.data("inventory")).items.find((i) => i.id === "rope")!.quantity).toBe(5);
    // A row the other writer never touched is no conflict.
    await r.write({ writes: [{ module: "inventory", base: rows("rope") as unknown as JsonValue, data: rows("rope", "lamp") as unknown as JsonValue }] });
    expect(readInventory(await r.data("inventory")).items.map((i) => i.id).sort()).toEqual(["lamp", "rope"]);
  });
});

describe("an accepted Refresh or Generate is the person's own write", () => {
  test("it stays with the reply through a new version and through choosing another, like any edit they make", async () => {
    const r = await rig();
    await r.write({ writes: [{ module: "resources", data: { ...DEFAULT_RESOURCES, hp: 33 } as unknown as JsonValue }] });
    await r.chats.addSwipe(r.reply.id, { content: "another" });
    await r.chats.selectSwipe(r.reply.id, 1);
    expect(readResources(await r.data("resources")).hp).toBe(33);
    await r.chats.selectSwipe(r.reply.id, 0);
    expect(readResources(await r.data("resources")).hp).toBe(33);
    expect((await r.states()).updates).toEqual({});
  });
});

describe("Undo of a reply's update", () => {
  test("writes the data from before the update as the person's own edit on that reply, and refuses once the module no longer holds what the update left, or when there is nothing to undo", async () => {
    const r = await rig();
    await r.chats.recordDeltas(r.branch, r.reply.swipes[r.reply.current]!.id, trackerDeltas("resources", undefined, { ...DEFAULT_RESOURCES, hp: 60 }, 9));
    await undoTrackerUpdate(r.chats, r.chat.id, "resources", r.reply.id, now);
    expect(readResources(await r.data("resources")).hp).toBe(100);
    await expect(undoTrackerUpdate(r.chats, r.chat.id, "resources", r.reply.id, now)).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(undoTrackerUpdate(r.chats, r.chat.id, "resources", "other", now)).rejects.toBeInstanceOf(StudioNotFoundError);
    await r.write({ writes: [{ module: "resources", data: { ...DEFAULT_RESOURCES, hp: 7 } as unknown as JsonValue }] });
    await expect(undoTrackerUpdate(r.chats, r.chat.id, "resources", r.reply.id, now)).rejects.toBeInstanceOf(StudioConflictError);
    expect(readResources(await r.data("resources")).hp).toBe(7);
  });

  test("a module changed by the person since the update is left as it is, with the sentence that says so", async () => {
    const r = await rig();
    await r.chats.recordDeltas(r.branch, r.reply.swipes[r.reply.current]!.id, trackerDeltas("resources", undefined, { ...DEFAULT_RESOURCES, hp: 60 }, 9));
    await r.write({ writes: [{ module: "resources", data: { ...DEFAULT_RESOURCES, hp: 7 } as unknown as JsonValue }] });
    const refused = await undoTrackerUpdate(r.chats, r.chat.id, "resources", r.reply.id, now).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(StudioConflictError);
    expect((refused as Error).message).toContain("left as it is");
    expect(readResources(await r.data("resources")).hp).toBe(7);
  });
});

describe("the routes", () => {
  test("the body is parsed once into known types, and a field it does not know is refused (a body or a write)", () => {
    const base = { chatId: "c1", branchId: "b1", messageId: "m1", expectedVersion: 3, writes: [{ module: "resources", data: null }] };
    expect(parseTrackerWrite(base)).toMatchObject({ chatId: "c1", expectedVersion: 3, writes: [{ module: "resources", data: null }] });
    for (const bad of [{ as: "robot" }, { writes: [{ module: "resources", data: null, as: "robot" }] }, { expectedVersion: 0 }, { expectedVersion: "3" }, { writes: [] }, { writes: [{ module: "wizardry", data: null }] }, { writes: [{ module: "resources" }] }, { writes: [{ module: "resources", data: null }, { module: "resources", data: null }] }, { chatId: "../x" }, { messageId: "" }]) {
      expect(() => parseTrackerWrite({ ...base, ...bad })).toThrow(StudioValidationError);
    }
  });

  test("GET answers the trackers, POST writes them and answers the same; a refusal is the status and sentence the server gives", async () => {
    const r = await rig();
    const run = async (method: string, url: string, body: Record<string, unknown> | null): Promise<{ status: number; body: Record<string, unknown> }> => {
      try {
        const res = await handleTrackerStateRoute(new Request("http://local/x", { method }), new URL(url), r.chats, now, body);
        return { status: res!.status, body: (await res!.json()) as Record<string, unknown> };
      } catch (e) {
        const res = studioErr(e);
        return { status: res.status, body: (await res.json()) as Record<string, unknown> };
      }
    };
    const got = await run("GET", `http://local/api/chats/tracker-state?chatId=${r.chat.id}`, null);
    expect(got.status).toBe(200);
    expect(got.body).toMatchObject({ branchId: r.branch, tipId: r.reply.id });
    const wrote = await run("POST", "http://local/api/chats/tracker-state", { chatId: r.chat.id, branchId: r.branch, messageId: r.reply.id, expectedVersion: got.body["branchVersion"], writes: [{ module: "resources", data: { ...DEFAULT_RESOURCES, hp: 40 } }] });
    expect(wrote.status).toBe(200);
    expect(readResources((wrote.body["data"] as Record<string, unknown>)["resources"]).hp).toBe(40);
    await r.chats.appendMessage(r.branch, { role: "user", content: "more" });
    const stale = await run("POST", "http://local/api/chats/tracker-state", { chatId: r.chat.id, branchId: r.branch, messageId: r.reply.id, expectedVersion: got.body["branchVersion"], writes: [{ module: "resources", data: null }] });
    expect(stale.status).toBe(409);
    expect(JSON.stringify(stale.body)).toContain("moved on");
    expect((await run("GET", "http://local/api/chats/tracker-state?chatId=nope", null)).status).toBe(404);
  });
});
