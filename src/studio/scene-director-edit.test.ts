/**
 * The Director panel's reads and edits: guarded by the version shown, soft removal, hidden items left out of the panel but kept in the snapshot, Reset keeping the activity, and the tier read.
 */
import { describe, expect, test } from "bun:test";
import { arcOf, hiddenOf, seedOf, stateOf } from "../core/director/fixtures";
import { DIRECTOR_PROP_ID } from "../core/director/settings";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { DEFAULT_RESOURCES } from "../core/trackers/resources";
import { memoryChatStore } from "../stage/store/chat-store";
import { DIRECTOR_EDIT_TIER, DIRECTOR_HISTORY_MAX, editDirector, readDirectorPanel, readEdit } from "./scene-director-edit";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";


const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };

async function rig() {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "Hi" }, { role: "assistant", content: "Evening." }]);
  const tip = (await chats.readMessages(chat.activeBranchId, { limit: 10 })).messages.at(-1)!.id;
  const deps = { chats, now: () => (now += 10) };
  const seed = async () => chats.putDirector(chat.id, tip, stateOf({ arcs: [arcOf()], seeds: [seedOf()], invisibleArcs: [hiddenOf()], notes: [{ id: "n1", content: "Keep Vera kind.", createdAt: 1 }], activity: [{ id: "a1", at: 5, turn: 1, type: "directive", result: "success", description: "d" }], nextId: 10 }), { expectedVersion: null });
  return { chats, chat, tip, deps, seed };
}

describe("reading the panel", () => {
  test("a story with no snapshot reads as empty with no version; the Prop and the settings ride with it", async () => {
    const r = await rig();
    const empty = await readDirectorPanel(r.deps, r.chat.id);
    expect(empty).toMatchObject({ on: false, version: null, tip: r.tip, settings: { personality: "the-balanced", commandMode: "tool-call", temperature: 0.7, autoRetry: true, creativity: "moderate" } });
    expect(empty.state.arcs).toEqual([]);
    await r.chats.setProps(r.chat.id, { on: [DIRECTOR_PROP_ID] });
    expect((await readDirectorPanel(r.deps, r.chat.id)).on).toBe(true);
    await expect(readDirectorPanel(r.deps, "nope")).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  test("the panel carries no tracker receipts: what a reply updated in a tracker is scene state, read from the trackers' state (tracker-state.ts), and a snapshot that names receipts is refused", async () => {
    const r = await rig();
    await r.chats.putDirector(r.chat.id, r.tip, stateOf({}), { expectedVersion: null });
    const panel = await readDirectorPanel(r.deps, r.chat.id);
    expect(panel).not.toHaveProperty("trackerUpdates");
    expect(panel.state).not.toHaveProperty("trackerUpdates");
    await expect(r.chats.putDirector(r.chat.id, r.tip, stateOf({ trackerUpdates: [] } as never), { expectedVersion: 1 })).rejects.toThrow("unknown field");
  });

  test("the panel leaves out what was removed and what was cleared, but the snapshot keeps both", async () => {
    const r = await rig();
    const first = (await r.seed())!;
    const panel = await editDirector(r.deps, r.chat.id, { op: "remove-arc", id: "arc-1" }, first.version);
    expect(panel.state.arcs).toEqual([]);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.state.arcs).toMatchObject([{ id: "arc-1", removedAt: expect.any(Number) }]);
  });
});

describe("edits", () => {
  test("mark complete, remove a seed, a hidden arc and a note: the model's rows are soft, the person's note goes to the archive, each leaves a line in the activity, each needs the version shown", async () => {
    const r = await rig();
    let version = (await r.seed())!.version;
    for (const edit of [{ op: "resolve-arc", id: "arc-1" }, { op: "remove-seed", id: "seed-1" }, { op: "remove-hidden", id: "hid-1" }, { op: "remove-note", id: "n1" }] as const) {
      const panel = await editDirector(r.deps, r.chat.id, edit, version);
      expect(panel.version).toBeGreaterThan(version);
      version = panel.version!;
    }
    const raw = (await r.chats.getDirector(r.chat.id, r.tip))!.state;
    expect(raw.arcs[0]!.status).toBe("complete");
    expect([raw.seeds[0]!.removedAt, raw.invisibleArcs[0]!.removedAt].every((t) => typeof t === "number")).toBe(true);
    expect(raw.notes).toEqual([]);
    expect(raw.activity.filter((a) => a.type === "edit").map((a) => a.description)).toEqual(['Marked arc "The Locked Room" complete', 'Removed seed "A cracked bell"', 'Removed hidden arc "The Ledger Conspiracy"', "Removed a note"]);
    const panel = await readDirectorPanel(r.deps, r.chat.id);
    expect([panel.state.seeds, panel.state.invisibleArcs, panel.state.notes].every((l) => l.length === 0)).toBe(true);
    expect(panel.archived.notes).toMatchObject([{ id: "n1", content: "Keep Vera kind.", removedAt: expect.any(Number) }]);
  });

  test("a hidden arc the person planted, once removed, leaves the snapshot for the archive; Reset archives what is live of theirs and keeps the archive", async () => {
    const r = await rig();
    const planted = await editDirector(r.deps, r.chat.id, { op: "add-hidden", title: "Debt", description: "d" }, null);
    await editDirector(r.deps, r.chat.id, { op: "add-note", content: "Slow." }, planted.version);
    const removed = await editDirector(r.deps, r.chat.id, { op: "remove-hidden", id: planted.state.invisibleArcs[0]!.id }, (await readDirectorPanel(r.deps, r.chat.id)).version);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.state.invisibleArcs).toEqual([]);
    expect(removed.archived.hidden).toMatchObject([{ title: "Debt", userAuthored: true, removedAt: expect.any(Number) }]);
    const reset = await editDirector(r.deps, r.chat.id, { op: "reset" }, removed.version);
    expect(reset.state.notes).toEqual([]);
    expect(reset.archived.notes.map((n) => n.content)).toEqual(["Slow."]);
    expect(reset.archived.hidden.map((h) => h.title)).toEqual(["Debt"]);
  });

  test("the person's hidden arc is marked as theirs, seeds the counter, and a note is added; both are bounded", async () => {
    const r = await rig();
    const first = await editDirector(r.deps, r.chat.id, { op: "add-hidden", title: "The harbor master's debt", description: "He owes the wrong people.", horizon: "long", surfaceCondition: "When the ledger is found" }, null);
    expect(first.state.invisibleArcs).toMatchObject([{ title: "The harbor master's debt", userAuthored: true, status: "seeding", horizon: "long", surfaceCondition: "When the ledger is found" }]);
    expect(first.version).not.toBeNull();
    const second = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "No sudden villains." }, first.version);
    expect(second.state.notes.map((n) => n.content)).toEqual(["No sudden villains."]);
    expect(second.state.notes[0]!.id).not.toBe(second.state.invisibleArcs[0]!.id);
    expect(() => readEdit({ op: "add-note", content: "x".repeat(601) })).toThrow(StudioValidationError);
    expect(() => readEdit({ op: "add-hidden", title: "" })).toThrow(StudioValidationError);
    expect(() => readEdit({ op: "add-hidden", title: "t", horizon: "soon" })).toThrow(StudioValidationError);
    expect(() => readEdit({ op: "burn-it-down" })).toThrow(StudioValidationError);
    expect(() => readEdit(null)).toThrow(StudioValidationError);
  });

  test("a stale version, or none where there is one, is a conflict and writes nothing; an unknown id is not found", async () => {
    const r = await rig();
    const v = (await r.seed())!.version;
    const stale = await editDirector(r.deps, r.chat.id, { op: "remove-note", id: "n1" }, v - 1).then(() => null, (e: unknown) => e);
    expect(stale).toBeInstanceOf(StudioConflictError);
    const none = await editDirector(r.deps, r.chat.id, { op: "remove-note", id: "n1" }, null).then(() => null, (e: unknown) => e);
    expect(none).toBeInstanceOf(StudioConflictError);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.state.notes[0]!.removedAt).toBeUndefined();
    const missing = await editDirector(r.deps, r.chat.id, { op: "remove-arc", id: "arc-404" }, v).then(() => null, (e: unknown) => e);
    expect(missing).toBeInstanceOf(StudioNotFoundError);
  });

  test("an edit lands at the new tip when only a message was added, and the old snapshot is left alone", async () => {
    const r = await rig();
    const v = (await r.seed())!.version;
    await r.chats.appendMessage(r.chat.activeBranchId, { role: "user", content: "And then?" });
    // The tip is now the new message; the panel's version still matches the effective snapshot, so the edit lands at the new tip.
    const panel = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "Later." }, v);
    expect(panel.tip).not.toBe(r.tip);
    expect(panel.state.notes.map((n) => n.content)).toEqual(["Keep Vera kind.", "Later."]);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.state.notes).toHaveLength(1);
  });

  test("clearing the activity is soft: the lines stay in the snapshot and leave the panel; later lines show", async () => {
    const r = await rig();
    const v = (await r.seed())!.version;
    const cleared = await editDirector(r.deps, r.chat.id, { op: "clear-activity" }, v);
    expect(cleared.state.activity).toEqual([]);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.state.activity).toHaveLength(1);
    const later = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "After." }, cleared.version);
    expect(later.state.activity.map((a) => a.description)).toEqual(["Added a note"]);
  });

  test("Reset empties the story, keeps the activity and the counter and says so; the earlier replies' snapshots are not touched", async () => {
    const r = await rig();
    const earlier = (await r.chats.readMessages(r.chat.activeBranchId, { limit: 10 })).messages[0]!.id;
    await r.chats.putDirector(r.chat.id, r.tip, stateOf({ arcs: [arcOf()], nextId: 10, activity: [{ id: "a1", at: 5, turn: 1, type: "directive", result: "success", description: "d" }] }), { expectedVersion: null });
    const v = (await r.chats.getDirector(r.chat.id, r.tip))!.version;
    const panel = await editDirector(r.deps, r.chat.id, { op: "reset" }, v);
    expect(panel.state.arcs).toEqual([]);
    expect(panel.state.activity.map((a) => a.description)).toEqual(["d", "Reset the Director's story"]);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.state.nextId).toBeGreaterThanOrEqual(10);
    expect(earlier).toBeTruthy();
  });

  test("a take with no messages has nothing to remember an edit at", async () => {
    const chats = memoryChatStore(() => 1);
    const chat = await chats.createChat({ title: "Empty", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    const e = await editDirector({ chats, now: () => 2 }, chat.id, { op: "add-note", content: "x" }, null).then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(StudioConflictError);
  });
});

describe("the tier", () => {
  test("editing is read from the scene tier table, at the write tier, and the Director's plan too", () => {
    expect(DIRECTOR_EDIT_TIER).toBe(SCENE_ACTION_TIERS["director.edit"]);
    expect(SCENE_ACTION_TIERS["director.edit"]).toBe("write");
    expect(SCENE_ACTION_TIERS["director.plan"]).toBe("write");
  });
});

describe("the capability badge", () => {
  const conn = (tools?: boolean) => ({ provider: { id: "p", send: async () => { throw new Error("no"); } }, kind: "k", ...(tools === undefined ? {} : { tools }) });

  test("native when the connection declares tools, none when it resolves without them, unknown when there is no connection or Kit lost it", async () => {
    const r = await rig();
    await r.chats.setConnection(r.chat.id, { id: "narr", model: "m" });
    const tools = async (connect: (c: { id: string }) => Promise<ReturnType<typeof conn> | null>) => (await readDirectorPanel({ chats: r.chats, connect: connect as never }, r.chat.id)).tools;
    expect(await tools(async () => conn(true))).toBe("native");
    expect(await tools(async () => conn())).toBe("none");
    expect(await tools(async () => conn(false))).toBe("none");
    expect(await tools(async () => null)).toBe("unknown");
    expect(await tools(async () => { throw new Error("gone"); })).toBe("unknown");
    expect((await readDirectorPanel(r.deps, r.chat.id)).tools).toBe("unknown");
  });

  test("the Director's own model is the one asked about, else the narrator's; no connection at all is unknown", async () => {
    const r = await rig();
    const asked: string[] = [];
    const connect = (async (c: { id: string }) => { asked.push(c.id); return conn(c.id === "own"); }) as never;
    expect((await readDirectorPanel({ chats: r.chats, connect }, r.chat.id)).tools).toBe("unknown");
    await r.chats.setConnection(r.chat.id, { id: "narr", model: "m" });
    expect((await readDirectorPanel({ chats: r.chats, connect }, r.chat.id)).tools).toBe("none");
    await r.chats.setDirectorSettings(r.chat.id, { model: { id: "own", model: "d" } });
    expect((await readDirectorPanel({ chats: r.chats, connect }, r.chat.id)).tools).toBe("native");
    expect(asked).toEqual(["narr", "own"]);
  });
});

describe("limits count what the person can act on", () => {
  test("at 200 live notes another is refused; removing one makes room, and the removed ones are not counted against it", async () => {
    const r = await rig();
    const notes = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, content: `note ${i}`, createdAt: i }));
    const first = (await r.chats.putDirector(r.chat.id, r.tip, stateOf({ notes }), { expectedVersion: null }))!;
    const full = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "one more" }, first.version).then(() => null, (e: unknown) => e);
    expect(full).toBeInstanceOf(StudioConflictError);
    expect(String((full as Error).message)).toContain("remove one first");
    const room = await editDirector(r.deps, r.chat.id, { op: "remove-note", id: "n0" }, first.version);
    const added = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "one more" }, room.version);
    expect(added.state.notes).toHaveLength(200);
    expect(added.archived.notes.map((n) => n.id)).toEqual(["n0"]);
  });
});

describe("when the person's own notes fill the snapshot", () => {
  const filled = () => {
    const notes = Array.from({ length: 190 }, (_, i) => ({ id: `n${i}`, content: "n".repeat(3_000), createdAt: i }));
    notes[0]!.content += "n".repeat(599_950 - JSON.stringify(stateOf({ notes })).length);
    return stateOf({ notes });
  };

  test("the panel says how full it is; an add that cannot fit is refused with advice that keeps their notes, never Reset, and writes nothing", async () => {
    const r = await rig();
    const first = (await r.chats.putDirector(r.chat.id, r.tip, filled(), { expectedVersion: null }))!;
    const panel = await readDirectorPanel(r.deps, r.chat.id);
    expect(panel.size).toEqual({ bytes: JSON.stringify(filled()).length, max: 600_000 });
    const refused = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "n".repeat(500) }, first.version).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(StudioConflictError);
    expect((refused as Error).message).toBe("Your notes and hidden arcs are too large to save. Remove some in the Debug tab.");
    expect((refused as Error).message).not.toMatch(/reset/i);
    expect((await r.chats.getDirector(r.chat.id, r.tip))!.version).toBe(first.version);
  });

  test("removing a note frees the room: the snapshot shrinks by it, the refusal clears, and the removed note is kept in the archive", async () => {
    const r = await rig();
    const first = (await r.chats.putDirector(r.chat.id, r.tip, filled(), { expectedVersion: null }))!;
    const freed = await editDirector(r.deps, r.chat.id, { op: "remove-note", id: "n5" }, first.version);
    expect(freed.size.bytes).toBeLessThan(JSON.stringify(first.state).length - 2_500);
    expect(freed.archived.notes).toMatchObject([{ id: "n5", content: "n".repeat(3_000) }]);
    const added = await editDirector(r.deps, r.chat.id, { op: "add-note", content: "n".repeat(500) }, freed.version);
    expect(added.state.notes).toHaveLength(190);
    expect(added.archived.notes).toHaveLength(1);
  });
});

describe("the turn stepper's reads", () => {
  /** A scene with `n` replies, each carrying a saved story whose turn is its number. */
  async function replies(n: number) {
    const r = await rig();
    let version: number | null = null;
    const ids: string[] = [];
    for (let i = 1; i <= n; i += 1) {
      const m = await r.chats.appendMessage(r.chat.activeBranchId, { role: "assistant", content: `reply ${i}` });
      ids.push(m!.id);
      version = (await r.chats.putDirector(r.chat.id, m!.id, stateOf({ turn: i, notes: [{ id: `n${i}`, content: `note ${i}`, createdAt: i }] }), { expectedVersion: version }))!.version;
    }
    return { ...r, ids };
  }

  test("history lists the replies that carry a story, oldest first, and no reply that carries none", async () => {
    const r = await replies(3);
    await r.chats.appendMessage(r.chat.activeBranchId, { role: "user", content: "and then" });
    const panel = await readDirectorPanel(r.deps, r.chat.id);
    expect(panel.history).toEqual(r.ids.map((messageId, i) => ({ messageId, turn: i + 1 })));
    expect(panel.at).toBeNull();
  });

  test("asking for an earlier reply reads the story saved on it, read only: the version and tip still name the latest", async () => {
    const r = await replies(3);
    const latest = await readDirectorPanel(r.deps, r.chat.id);
    const early = await readDirectorPanel(r.deps, r.chat.id, { at: r.ids[0] });
    expect(early.state.turn).toBe(1);
    expect(early.state.notes.map((n) => n.id)).toEqual(["n1"]);
    expect(early.at).toBe(r.ids[0]!);
    expect([early.version, early.tip]).toEqual([latest.version, latest.tip]);
    expect(latest.state.turn).toBe(3);
  });

  test("a reply with no story, or one that is not on the take, is refused", async () => {
    const r = await replies(2);
    const bare = (await r.chats.appendMessage(r.chat.activeBranchId, { role: "user", content: "hm" }))!;
    await expect(readDirectorPanel(r.deps, r.chat.id, { at: bare.id })).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(readDirectorPanel(r.deps, r.chat.id, { at: "nope" })).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  test("only the take being read counts: a fork's later replies are not in the main take's history", async () => {
    const r = await replies(2);
    const main0 = r.chat.activeBranchId;
    const fork = (await r.chats.fork(main0, r.ids[1]!, { name: "Take 2" }))!;
    const tip = (await r.chats.readMessages(fork.id, { limit: 20 })).messages.at(-1)!;
    const extra = (await r.chats.appendMessage(fork.id, { role: "assistant", content: "fork only" }))!;
    await r.chats.putDirector(r.chat.id, extra.id, stateOf({ turn: 9 }), { expectedVersion: (await r.chats.getDirector(r.chat.id, tip.id))!.version });
    await r.chats.setActiveBranch(r.chat.id, main0);
    const main = await readDirectorPanel(r.deps, r.chat.id);
    expect(main.history.map((h) => h.turn)).toEqual([1, 2]);
    await r.chats.setActiveBranch(r.chat.id, fork.id);
    const onFork = await readDirectorPanel(r.deps, r.chat.id);
    expect(onFork.history.map((h) => h.turn)).toEqual([1, 2, 9]);
    await expect(readDirectorPanel(r.deps, r.chat.id, { at: r.ids[1] })).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  test("history keeps the newest 150", async () => {
    const r = await replies(152);
    const panel = await readDirectorPanel(r.deps, r.chat.id);
    expect(panel.history).toHaveLength(DIRECTOR_HISTORY_MAX);
    expect([panel.history[0]!.turn, panel.history.at(-1)!.turn]).toEqual([3, 152]);
  });
});
