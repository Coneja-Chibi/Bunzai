/**
 * The Story Director through the turn loop, continued: the person's panel edits survive a new version of the reply (behavior 12), the turn is counted in the state, a long
 * story still saves, the Director's call does not outlive the turn, and more than one planning call in a reply is one plan.
 */
import { describe, expect, test } from "bun:test";
import { DIRECTOR_HEADER } from "../core/assembly/director";
import { arcOf, seedOf, stateOf } from "../core/director/fixtures";
import { blankDirector } from "../stage/contracts/chat-store.contract-director";
import type { DirectorState } from "../stage/contracts/director-types";
import type { ProviderCompletion } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { ARGS, buildScene, call, contents, text, type SceneOptions } from "./fake-director-rig";
import { editDirector, readDirectorPanel, type DirectorEdit } from "./scene-director-edit";

const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));

describe("a long story still saves", () => {
  /** A valid state whose serialized size is exactly `target`, made of seeds, with `lines` activity lines of 1,500 characters first. */
  function sized(target: number, lines: number): DirectorState {
    const state = stateOf({
      activity: Array.from({ length: lines }, (_, i) => ({ id: `old-${i}`, at: i, turn: 1, type: "momentum" as const, result: "info" as const, description: "x", details: "d".repeat(1_500) })),
      seeds: Array.from({ length: 400 }, (_, i) => seedOf({ id: `s${i}`, hint: `Seed ${i}`, payoff: "" })),
    });
    const per = Math.floor((target - JSON.stringify(state).length) / 400);
    for (const seed of state.seeds) seed.payoff = "p".repeat(per);
    state.seeds[0]!.payoff += "p".repeat(target - JSON.stringify(state).length);
    expect(JSON.stringify(state).length).toBe(target);
    return state;
  }

  test("a story already at the store's limit gives up its oldest activity lines, not the turn's snapshot", async () => {
    const s = await scene();
    const user = await s.tip();
    await s.chats.putDirector(s.chat.id, user.id, sized(599_800, 60), { expectedVersion: null });
    await s.turn();
    const snap = (await s.stored())!;
    expect(snap.messageId).toBe((await s.tip()).id);
    expect(JSON.stringify(snap.state).length).toBeLessThanOrEqual(600_000);
    expect(snap.state.arcs.map((a) => a.title)).toEqual(["The Lamp"]);
    expect(snap.state.activity.at(-1)!.type).toBe("turn_finish");
    expect(snap.state.activity.length).toBeLessThan(60 + 5);
    expect(snap.state.activity.some((a) => a.id === "old-0")).toBe(false);
    expect(s.events.filter((e) => e.type === "director").map((e) => (e as { status: string }).status)).toEqual(["planning", "planned"]);
  });

  test("when even that cannot make room, the page is told the state was not saved, and the reply is still kept", async () => {
    const s = await scene();
    const user = await s.tip();
    // Only the person's own notes, which nothing may prune: there is nothing to give up, so the store's refusal is what the page hears of.
    const notes = Array.from({ length: 440 }, (_, i) => ({ id: "n" + i, content: "n".repeat(1_300), createdAt: i }));
    notes[0]!.content += "n".repeat(599_990 - JSON.stringify(stateOf({ notes })).length);
    await s.chats.putDirector(s.chat.id, user.id, stateOf({ notes }), { expectedVersion: null });
    await s.turn();
    expect(s.events.filter((e) => e.type === "director").at(-1)).toMatchObject({ status: "failed", reason: "Your notes and hidden arcs are too large to save. Remove some in the Debug tab." });
    expect(s.events.some((e) => e.type === "done")).toBe(true);
    expect((await s.stored())!.messageId).toBe(user.id);
  });
});

describe("the person's edits survive a new version of the reply (behavior 11)", () => {
  const edit = async (s: Awaited<ReturnType<typeof scene>>, op: DirectorEdit) => {
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    return editDirector({ chats: s.chats, now: () => 9_000 }, s.chat.id, op, panel.version);
  };
  const liveNotes = async (s: Awaited<ReturnType<typeof scene>>) => (await s.stored())!.state.notes.filter((n) => n.removedAt === undefined).map((n) => n.content);

  test("edit, then regenerate: the new version has the note, and the planner was shown it", async () => {
    const s = await scene();
    await s.turn();
    await edit(s, { op: "add-note", content: "Keep Vera kind." });
    await s.turn("swipe");
    expect(await liveNotes(s)).toEqual(["Keep Vera kind."]);
    expect(s.planner[1]!.messages[1]!.content).toContain("- [");
    expect(s.planner[1]!.messages[1]!.content).toContain("Keep Vera kind.");
    expect((await s.stored())!.state.arcs.map((a) => a.title)).toEqual(["The Lamp"]);
  });

  test("edit, then swipe, then edit, then swipe again: every edit rides along, and the older version still shows only its own", async () => {
    const s = await scene();
    await s.turn();
    await edit(s, { op: "add-note", content: "First." });
    await s.turn("swipe");
    await edit(s, { op: "add-hidden", title: "The harbor master's debt", description: "He owes the wrong people." });
    await s.turn("swipe");
    const state = (await s.stored())!.state;
    expect(state.notes.map((n) => n.content)).toEqual(["First."]);
    expect(state.invisibleArcs.filter((a) => a.userAuthored).map((a) => a.title)).toEqual(["The harbor master's debt"]);
    expect(state.edits!.map((e) => e.edit.op)).toEqual(["add-note", "add-hidden"]);
    const reply = await s.tip();
    await s.chats.selectSwipe(reply.id, 0);
    const first = (await s.stored())!.state;
    expect(first.notes.map((n) => n.content)).toEqual(["First."]);
    expect(first.invisibleArcs.filter((a) => a.userAuthored)).toEqual([]);
  });

  test("edit, then a guided re-roll: carried too", async () => {
    const s = await scene();
    await s.turn();
    await edit(s, { op: "add-note", content: "Slow burn." });
    await s.turn("swipe", "Make her colder.");
    expect(await liveNotes(s)).toEqual(["Slow burn."]);
  });

  test("a removal and a mark-complete survive; an item the replaced round made and the new round makes again is still removed", async () => {
    const s = await scene();
    await s.turn();
    const state = (await s.stored())!.state;
    await edit(s, { op: "remove-seed", id: state.seeds[0]!.id });
    await edit(s, { op: "resolve-arc", id: state.arcs[0]!.id });
    await s.turn("swipe");
    const after = (await s.stored())!.state;
    expect(after.seeds.filter((x) => x.removedAt === undefined)).toEqual([]);
    expect(after.seeds.some((x) => x.removedAt !== undefined && x.hint === "The cracked bell")).toBe(true);
    expect(after.arcs.map((a) => a.status)).toEqual(["complete"]);
  });

  test("a note added and then removed stays out through a regenerate and a swipe, and the archive keeps it", async () => {
    const s = await scene();
    await s.turn();
    const added = await edit(s, { op: "add-note", content: "Mine, then gone." });
    await edit(s, { op: "remove-note", id: added.state.notes[0]!.id });
    await s.turn("swipe");
    await s.turn("swipe");
    expect(await liveNotes(s)).toEqual([]);
    expect((await s.stored())!.state.notes).toEqual([]);
    const panel = await readDirectorPanel({ chats: s.chats }, s.chat.id);
    expect(panel.archived.notes.map((n) => n.content)).toEqual(["Mine, then gone."]);
  });

  test("an edit made while a send's planning call is out is kept; so is one made while a regenerate's is", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const send = await scene({ planner: [gate] });
    const run = send.turn();
    for (let i = 0; i < 200 && send.planner.length === 0; i++) await Bun.sleep(5);
    await send.chats.putDirector(send.chat.id, (await send.tip()).id, blankDirector("Mid send."), { expectedVersion: null });
    release(call(ARGS()));
    await run;
    expect(await liveNotes(send)).toEqual(["Mid send."]);

    let release2!: (c: ProviderCompletion) => void;
    const gate2 = new Promise<ProviderCompletion>((resolve) => { release2 = resolve; });
    const swipe = await scene({ planner: [call(ARGS()), gate2] });
    await swipe.turn();
    const second = swipe.turn("swipe");
    for (let i = 0; i < 200 && swipe.planner.length < 2; i++) await Bun.sleep(5);
    await edit(swipe, { op: "add-note", content: "Mid regenerate." });
    release2(call(ARGS()));
    await second;
    expect(await liveNotes(swipe)).toEqual(["Mid regenerate."]);
    expect((await swipe.stored())!.state.arcs.map((a) => a.title)).toEqual(["The Lamp"]);
  });

  test("Reset, then regenerate: the story stays reset (and the planner saw it empty), the new round fills it; an edit after the Reset still applies", async () => {
    const s = await scene();
    await s.turn();
    await edit(s, { op: "reset" });
    await edit(s, { op: "add-note", content: "After the reset." });
    await s.turn("swipe");
    expect(s.planner[1]!.messages[1]!.content).toContain("No chapter defined yet");
    expect(s.planner[1]!.messages[1]!.content).toContain("After the reset.");
    const state = (await s.stored())!.state;
    expect(state.chapters).toHaveLength(1);
    expect(state.chapters[0]!.number).toBe(1);
    expect(state.arcs.map((a) => a.title)).toEqual(["The Lamp"]);
    expect(state.notes.filter((n) => n.removedAt === undefined).map((n) => n.content)).toEqual(["After the reset."]);
    expect(state.edits!.map((e) => e.edit.op)).toEqual(["reset", "add-note"]);
  });

  test("a failed plan carries the edits too", async () => {
    const s = await scene({ planner: [call(ARGS()), text("no"), text("no")] });
    await s.turn();
    await edit(s, { op: "add-note", content: "Keep." });
    await s.turn("swipe");
    expect((await s.stored())!.state.activity.some((a) => a.type === "turn_error")).toBe(true);
    expect(await liveNotes(s)).toEqual(["Keep."]);
  });

  const arcs = (titles: string[]) => ARGS({ arcUpdates: titles.map((t) => ({ arcId: t, title: t, description: t })), seedUpdates: [] });
  const byTitle = async (s: Awaited<ReturnType<typeof scene>>, title: string) => (await s.stored())!.state.arcs.find((a) => a.title === title)!;

  test("R1: remove an arc, then regenerate: the new round hands the same ids to other arcs, and none of them is removed", async () => {
    const s = await scene({ planner: [call(arcs(["The Lamp", "The Bell"])), call(arcs(["The Storm", "The Tide"]))] });
    await s.turn();
    await edit(s, { op: "remove-arc", id: (await byTitle(s, "The Bell")).id });
    await s.turn("swipe");
    const state = (await s.stored())!.state;
    expect(state.arcs.map((a) => [a.title, a.removedAt === undefined])).toEqual([["The Storm", true], ["The Tide", true]]);
    expect(state.edits!.map((e) => e.edit.op)).toEqual(["remove-arc"]);
  });

  test("R2: mark an arc complete, then regenerate: the arc that reuses its id is not completed; one the new round makes again under the same name is", async () => {
    const reuse = await scene({ planner: [call(arcs(["The Lamp"])), call(arcs(["The Storm"]))] });
    await reuse.turn();
    await edit(reuse, { op: "resolve-arc", id: (await byTitle(reuse, "The Lamp")).id });
    await reuse.turn("swipe");
    expect((await byTitle(reuse, "The Storm")).status).not.toBe("complete");
    const again = await scene({ planner: [call(arcs(["The Lamp"])), call(arcs(["The Lamp"]))] });
    await again.turn();
    await edit(again, { op: "resolve-arc", id: (await byTitle(again, "The Lamp")).id });
    await again.turn("swipe");
    expect((await byTitle(again, "The Lamp")).status).toBe("complete");
  });
});

describe("the turn number is counted in the state", () => {
  test("a story forty turns in plans turn 40 whatever the window holds, momentum fires from it, and hiding an old message does not lower it", async () => {
    const s = await scene();
    const user = await s.tip();
    await s.chats.putDirector(s.chat.id, user.id, stateOf({ turn: 39, arcs: [arcOf({ lastProgressTurn: 1 })] }), { expectedVersion: null });
    await s.turn();
    const prompt = s.planner[0]!.messages[1]!.content;
    expect(prompt).toContain("## Turn 40");
    expect(prompt).toContain("MANDATORY ARC ACTIONS THIS TURN");
    expect((await s.stored())!.state.turn).toBe(40);
    const first = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 5 })).messages[0]!;
    await s.chats.setHidden(first.id, true);
    await s.turn("swipe");
    expect(s.planner[1]!.messages[1]!.content).toContain("## Turn 40");
    expect((await s.stored())!.state.turn).toBe(40);
  });

  test("a failed plan still counts the turn, so the count never stalls behind a flaky model", async () => {
    const s = await scene({ planner: [text("no"), text("no")] });
    await s.turn();
    expect((await s.stored())!.state.turn).toBe(1);
  });
});

describe("the Director's call does not outlive the turn", () => {
  test("when recall throws, the planning call is aborted and the turn fails as it always did", async () => {
    const s = await scene({ compendium: { on: true, model: { id: "boom", model: "x" } }, planner: ["hang"] });
    const connect = s.deps.connect;
    s.deps.connect = async (c?: { id: string; model: string }) => { if (c?.id === "boom") throw new Error("boom"); return connect(c); };
    await s.turn();
    for (let i = 0; i < 100 && s.aborted.length === 0; i++) await Bun.sleep(5);
    expect(s.aborted).toEqual([true]);
    expect(s.events.some((e) => e.type === "failed")).toBe(true);
    expect(s.narrator).toHaveLength(0);
    expect(await s.stored()).toBeNull();
  });
});

describe("more than one planning call in a reply", () => {
  const twice = (second: Record<string, unknown>): ProviderCompletion => ({
    content: "", finish_reason: "tool_calls", raw: {},
    tool_calls: [
      { id: "c1", type: "function", function: { name: "commit_planning_round", arguments: JSON.stringify(ARGS()) } },
      { id: "c2", type: "function", function: { name: "commit_planning_round", arguments: JSON.stringify(second) } },
    ],
  });

  test("the first is used, the rest are ignored, and one activity line says so; no corrective pass is spent", async () => {
    const s = await scene({ planner: [twice(ARGS({ chapterUpdate: { action: "start_new", title: "Ignored" } }))] });
    await s.turn();
    expect(s.planner).toHaveLength(1);
    const state = (await s.stored())!.state;
    expect(state.chapters[0]!.title).toBe("Arrival");
    expect(state.activity.map((a) => a.description)).toContain("extra planning call ignored");
    expect(contents(s.narrator[0]!).some((c) => c.startsWith(DIRECTOR_HEADER))).toBe(true);
  });

  test("a different command alongside the plan is ignored too, and a reply with only other commands is still a failure", async () => {
    const mixed: ProviderCompletion = { content: "", finish_reason: "tool_calls", raw: {}, tool_calls: [
      { id: "a", type: "function", function: { name: "set_directive", arguments: "{}" } },
      { id: "b", type: "function", function: { name: "commit_planning_round", arguments: JSON.stringify(ARGS()) } },
    ] };
    const ok = await scene({ planner: [mixed] });
    await ok.turn();
    expect(ok.planner).toHaveLength(1);
    expect(contents(ok.narrator[0]!).some((c) => c.startsWith(DIRECTOR_HEADER))).toBe(true);
    const wrong = await scene({ planner: [call({}, "set_directive"), call({}, "set_directive")] });
    await wrong.turn();
    expect((await wrong.stored())!.state.activity.map((a) => a.description)).toContain("Story Director omitted its required planning command.");
  });
});
