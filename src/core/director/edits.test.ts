/** The person's edits as operations: applied, remembered, and carried onto another state without being applied twice. */
import { describe, expect, test } from "bun:test";
import { DIRECTOR_CAPS, DIRECTOR_LIVE_CAPS, type DirectorEdit } from "../../stage/contracts/director-types";
import { TOO_LARGE, applyEdit, record, refusal, replay, retry } from "./edits";
import { arcOf, hiddenOf, seedOf, stateOf } from "./fixtures";

const make = (s = stateOf(), edit: DirectorEdit, at = 10) => record(applyEdit(s, edit, at)!.state, edit, at);

describe("replay", () => {
  test("applies each edit the source remembers and the target lacks, in order, and remembers them under the same ids", () => {
    const source = make(make(stateOf(), { op: "add-note", content: "One." }, 10), { op: "add-hidden", title: "Debt" }, 20);
    const out = replay(stateOf({ nextId: 50 }), source);
    expect(out.notes.map((n) => n.content)).toEqual(["One."]);
    expect(out.invisibleArcs.map((a) => [a.title, a.userAuthored])).toEqual([["Debt", true]]);
    expect(out.edits!.map((e) => e.id)).toEqual(source.edits!.map((e) => e.id));
    expect(out.notes[0]!.createdAt).toBe(10);
  });

  test("an edit the target already remembers is not applied again, so replaying twice changes nothing", () => {
    const source = make(stateOf(), { op: "add-note", content: "One." });
    const once = replay(stateOf(), source);
    const twice = replay(once, source);
    expect(twice.notes).toHaveLength(1);
    expect(twice.edits).toHaveLength(1);
  });

  test("an id-edit applies to the item it was made on - the same id AND the same name - and to nothing else; one whose item is not there is handed back, remembered, and retried", () => {
    const made = stateOf({ arcs: [arcOf({ id: "arc-1", title: "The Lamp" })], seeds: [seedOf({ id: "seed-1", hint: "Bell" })] });
    const removeArc: DirectorEdit = { op: "remove-arc", id: "arc-1" };
    const removeSeed: DirectorEdit = { op: "remove-seed", id: "seed-1" };
    const one = record(applyEdit(made, removeArc, 5, "The Lamp")!.state, removeArc, 5, "The Lamp");
    const source = record({ ...one, nextId: 40 }, removeSeed, 6, "Bell");
    const missed: never[] = [];
    // The same id with the same name (case and punctuation aside) is the same item.
    const target = replay(stateOf({ arcs: [arcOf({ id: "arc-1", title: "The  lamp!" })] }), source, missed);
    expect(target.arcs[0]!.removedAt).toBe(5);
    expect(missed).toHaveLength(1);
    expect(target.edits!.map((e) => e.edit.op)).toEqual(["remove-arc", "remove-seed"]);
    const later = retry({ ...target, seeds: [seedOf({ id: "seed-1", hint: "BELL" })] }, missed);
    expect(later.seeds[0]!.removedAt).toBe(6);
    expect(retry(target, missed).seeds).toEqual([]);
  });

  test("R1: a regenerate hands the same ids to different arcs; the edit made to \"The Bell\" does not touch \"The Tide\" that now holds its id, and one with the same name under another id is left alone too", () => {
    const v1 = stateOf({ arcs: [arcOf({ id: "arc-2", title: "The Lamp" }), arcOf({ id: "arc-4", title: "The Bell" })] });
    const edit: DirectorEdit = { op: "remove-arc", id: "arc-4" };
    const source = record(applyEdit(v1, edit, 5, "The Bell")!.state, edit, 5, "The Bell");
    const v2 = stateOf({ arcs: [arcOf({ id: "arc-2", title: "The Storm" }), arcOf({ id: "arc-4", title: "The Tide" }), arcOf({ id: "arc-6", title: "The Bell" })] });
    const missed: never[] = [];
    const out = retry(replay(v2, source, missed), missed);
    expect(out.arcs.map((a) => a.removedAt)).toEqual([undefined, undefined, undefined]);
    expect(missed).toHaveLength(1);
    expect(out.edits!.map((e) => e.edit.op)).toEqual(["remove-arc"]);
  });

  test("R2: marking \"The Lamp\" complete does not complete \"The Storm\" that reuses its id", () => {
    const v1 = stateOf({ arcs: [arcOf({ id: "arc-2", title: "The Lamp" })] });
    const edit: DirectorEdit = { op: "resolve-arc", id: "arc-2" };
    const source = record(applyEdit(v1, edit, 5, "The Lamp")!.state, edit, 5, "The Lamp");
    const out = retry(replay(stateOf({ arcs: [arcOf({ id: "arc-2", title: "The Storm", status: "building" })] }), source, []), [source.edits![0]!]);
    expect(out.arcs[0]!.status).toBe("building");
  });

  test("an edit with no recorded name finds nothing, so a record that lost its name cannot hit a stranger", () => {
    const state = stateOf({ arcs: [arcOf({ id: "arc-1", title: "The Lamp" })] });
    expect(applyEdit(state, { op: "remove-arc", id: "arc-1" }, 5)).toBeNull();
  });

  test("Reset empties the story but keeps the activity, the counters and the record; an edit after it applies to the emptied story", () => {
    const base = stateOf({ arcs: [arcOf()], activity: [{ id: "a", at: 1, turn: 1, type: "arc", result: "info", description: "d" }], turn: 7, nextId: 30 });
    const reset = make(base, { op: "reset" });
    expect(reset).toMatchObject({ arcs: [], turn: 7, nextId: 31 });
    expect(reset.activity).toHaveLength(1);
    expect(reset.edits).toHaveLength(1);
    const after = make(reset, { op: "add-note", content: "After." });
    const carried = replay(stateOf({ arcs: [arcOf({ id: "fresh", title: "Fresh" })] }), after);
    expect(carried.arcs).toEqual([]);
    expect(carried.notes.map((n) => n.content)).toEqual(["After."]);
  });
});

describe("the record", () => {
  test("keeps the last 50 edits", () => {
    let s = stateOf();
    for (let i = 0; i < DIRECTOR_CAPS.edits + 5; i++) s = record(s, { op: "clear-activity" }, i);
    expect(s.edits).toHaveLength(DIRECTOR_CAPS.edits);
    expect(s.edits![0]!.at).toBe(5);
  });
});

describe("caps count what a person can act on", () => {
  test("200 live notes refuse another, but removed ones do not count toward that", () => {
    const notes = Array.from({ length: DIRECTOR_LIVE_CAPS.notes }, (_, i) => ({ id: `n${i}`, content: "x", createdAt: i }));
    expect(refusal(stateOf({ notes }), { op: "add-note", content: "y" })).toContain("remove one first");
    const removed = notes.map((n, i) => (i < 150 ? { ...n, removedAt: 1 } : n));
    expect(refusal(stateOf({ notes: removed }), { op: "add-note", content: "y" })).toBeNull();
  });

  test("hidden arcs the same; a list full of the model's removed rows gives one up for the new arc, and never one of the person's", () => {
    const arcs = Array.from({ length: DIRECTOR_LIVE_CAPS.invisibleArcs }, (_, i) => hiddenOf({ id: `h${i}`, title: `H${i}` }));
    expect(refusal(stateOf({ invisibleArcs: arcs }), { op: "add-hidden", title: "t" })).toContain("remove one first");
    const model = Array.from({ length: DIRECTOR_CAPS.invisibleArcs }, (_, i) => hiddenOf({ id: `h${i}`, title: `H${i}`, removedAt: 1 }));
    const made = applyEdit(stateOf({ invisibleArcs: model }), { op: "add-hidden", title: "t" }, 5, undefined, "edit-9")!;
    expect(made.state.invisibleArcs).toHaveLength(DIRECTOR_CAPS.invisibleArcs);
    expect(made.state.invisibleArcs.at(-1)).toMatchObject({ id: "hidden-edit-9", userAuthored: true });
    const theirs = model.map((a) => ({ ...a, userAuthored: true as const }));
    expect(applyEdit(stateOf({ invisibleArcs: theirs }), { op: "add-hidden", title: "t" }, 5, undefined, "edit-9")).toBeNull();
    expect(refusal(stateOf(), { op: "reset" })).toBeNull();
  });
});
