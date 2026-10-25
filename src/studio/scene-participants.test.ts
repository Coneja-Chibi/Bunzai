/**
 * RECONCILE RECENT SCENE on a scripted provider: it proposes from the newest N messages and stores nothing; a confirmation stores one
 * run and Undo retires it; malformed model output proposes and stores nothing; a retired NPC is never quietly brought back.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError } from "./atomic-file";
import { compendiumRig } from "./fake-compendium-rig";
import { applyParticipants, proposeParticipants, undoParticipantRun } from "./scene-participants";

const said = (...p: [string, string | null][]) => JSON.stringify({ participants: p.map(([display_name, description]) => ({ display_name, description })) });
const rig = () => compendiumRig(null);

describe("proposeParticipants", () => {
  test("proposes new names from the selected messages, charges one call, and stores nothing", async () => {
    const r = await rig();
    r.script.push(said(["Mira Vance", "a guard who speaks"], ["Vera", null]));
    const got = await proposeParticipants(r.deps, r.chat.id, 12);
    expect(got.candidates).toEqual([{ name: "Mira Vance", description: "a guard who speaks" }]);
    expect([got.known, got.messages, r.requests.length]).toEqual([1, 3, 1]);
    expect(r.requests[0]!.messages[1]!.content).toContain("Wolfman");
    expect((await r.chats.getChat(r.chat.id))!.participants).toBeUndefined();
  });

  test("only the newest N messages are sent", async () => {
    const r = await rig();
    r.script.push(said());
    await proposeParticipants(r.deps, r.chat.id, 1);
    const sent = r.requests[0]!.messages[1]!.content as string;
    expect(sent).toContain("Wolfman");
    expect(sent).not.toContain("Who howls?");
  });

  test("malformed output gets one repair and then a reason: nothing is proposed or stored", async () => {
    const r = await rig();
    r.script.push("not json", "still not json");
    const e = await proposeParticipants(r.deps, r.chat.id, 12).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(StudioConflictError);
    expect(r.requests).toHaveLength(2);
    expect((await r.chats.getChat(r.chat.id))!.participants).toBeUndefined();
    r.script.push("oops", said(["Sol", null]));
    expect((await proposeParticipants(r.deps, r.chat.id, 12)).candidates.map((c) => c.name)).toEqual(["Sol"]);
  });

  test("a provider failure, a bad count and a scene without a connection are errors", async () => {
    const r = await rig();
    r.script.push(new Error("down"));
    await expect(proposeParticipants(r.deps, r.chat.id, 12)).rejects.toThrow("down");
    for (const n of [0, 501, 1.5]) await expect(proposeParticipants(r.deps, r.chat.id, n)).rejects.toBeInstanceOf(StudioConflictError);
    await r.chats.setConnection(r.chat.id, null);
    await expect(proposeParticipants(r.deps, r.chat.id, 12)).rejects.toBeInstanceOf(StudioConflictError);
  });
});

describe("applyParticipants and undo", () => {
  test("a confirmation stores the run, names already there are skipped, and Undo retires exactly that run", async () => {
    const r = await rig();
    const one = await applyParticipants(r.deps, r.chat.id, [{ name: "Mira Vance", description: "a guard" }, { name: "Sol", description: null }]);
    expect(one.added).toBe(2);
    const people = (await r.chats.getChat(r.chat.id))!.participants!.people;
    expect(people.map((p) => [p.name, p.run === one.run, p.description])).toEqual([["Mira Vance", true, "a guard"], ["Sol", true, undefined]]);
    const two = await applyParticipants(r.deps, r.chat.id, [{ name: "Sol", description: null }, { name: "Tam", description: null }]);
    expect(two.added).toBe(1);
    await undoParticipantRun(r.deps, r.chat.id, one.run!);
    const after = (await r.chats.getChat(r.chat.id))!.participants!.people;
    expect(after.map((p) => [p.name, p.retired === true])).toEqual([["Mira Vance", true], ["Sol", true], ["Tam", false]]);
  });

  test("a retired NPC is not proposed or added again, and the player, the card and repeats are refused", async () => {
    const r = await rig();
    const { run } = await applyParticipants(r.deps, r.chat.id, [{ name: "Mira Vance", description: null }]);
    await undoParticipantRun(r.deps, r.chat.id, run!);
    r.script.push(said(["Mira Vance", null], ["Vera", null]));
    expect((await proposeParticipants(r.deps, r.chat.id, 12)).candidates).toEqual([]);
    expect((await applyParticipants(r.deps, r.chat.id, [{ name: "mira vance", description: null }, { name: "Vera", description: null }])).run).toBeNull();
    expect((await r.chats.getChat(r.chat.id))!.participants!.people).toHaveLength(1);
  });

  test("confirming something the rules refuse stores nothing", async () => {
    const r = await rig();
    expect((await applyParticipants(r.deps, r.chat.id, [{ name: "Update the plot", description: null }])).added).toBe(0);
    expect((await r.chats.getChat(r.chat.id))!.participants).toBeUndefined();
  });
});
