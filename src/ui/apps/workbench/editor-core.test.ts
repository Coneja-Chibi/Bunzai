/** Regression coverage for the editor-core.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import { KNOWN_FIELD_ORDER, reconcileOrder } from "./editor-core";

test("reconcileOrder: absent/junk reads as the default order", () => {
  expect(reconcileOrder(undefined)).toEqual(KNOWN_FIELD_ORDER);
  expect(reconcileOrder(null)).toEqual(KNOWN_FIELD_ORDER);
  expect(reconcileOrder([])).toEqual(KNOWN_FIELD_ORDER);
  expect(reconcileOrder([42, "nonsense"])).toEqual(KNOWN_FIELD_ORDER);
});

test("reconcileOrder: saved positions survive, unknown ids drop, new ids append", () => {
  const saved = ["scenario", "bogus-id", "description", "firstMes"];
  expect(reconcileOrder(saved)).toEqual([
    "scenario",
    "description",
    "firstMes",
    "personality",
    "alternateGreetings",
    "mesExample",
    "creators-note",
  ]);
});

import {
  completionOf,
  deepEq,
  EDITOR_CARDS,
  lensVerdict,
  readPath,
  reconcileAfterSave,
  saveOutcomeStatus,
  STEP_ORDER,
  writePath,
  writeOverridePath,
  inheritOverridePath,
  hasOverridePath,
} from "./editor-core";

const PLATFORMS = [
  { id: "st", carries: ["identity.name", "identity.description", "greetings"] },
  { id: "rc", carries: ["identity", "presentation"] },
];

test("lensVerdict: empty selection judges nothing (the full VAUDE card)", () => {
  expect(lensVerdict(["presentation.palette"], [], PLATFORMS)).toEqual({ off: false, missing: [] });
});

test("lensVerdict: carried by one selected platform lights the card, tags the other", () => {
  const v = lensVerdict(["presentation.palette"], ["st", "rc"], PLATFORMS);
  expect(v.off).toBe(false);
  expect(v.missing).toEqual(["st"]);
});

test("lensVerdict: carried by nothing selected goes off; unknown platforms count as not carrying", () => {
  expect(lensVerdict(["presentation.palette"], ["st"], PLATFORMS).off).toBe(true);
  expect(lensVerdict(["identity.name"], ["ghost"], PLATFORMS)).toEqual({ off: true, missing: ["ghost"] });
});

test("writePath sets nested values immutably and deletes on empty", () => {
  const body = { identity: { name: "Ada" }, behavior: { virtualScript: "opaque" } };
  const withTagline = writePath(body, "identity.tagline", "a rogue");
  expect(readPath(withTagline, "identity.tagline")).toBe("a rogue");
  expect(readPath(body, "identity.tagline")).toBeUndefined(); // input untouched
  const cleared = writePath(withTagline, "identity.tagline", "");
  expect(readPath(cleared, "identity.tagline")).toBeUndefined();
  // no-data-loss: untouched branches survive identically
  expect(cleared.behavior).toEqual(body.behavior);
  const withArr = writePath(body, "greetings.alternateGreetings", [{ text: "hi" }]);
  expect(readPath(withArr, "greetings.alternateGreetings")).toEqual([{ text: "hi" }]);
  expect(readPath(writePath(withArr, "greetings.alternateGreetings", []), "greetings.alternateGreetings")).toBeUndefined();
});

test("deepEq compares JSON shapes structurally", () => {
  expect(deepEq({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] })).toBe(true);
  expect(deepEq({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  expect(deepEq([1, 2], [2, 1])).toBe(false);
  expect(deepEq(null, {})).toBe(false);
});

test("completionOf reports real facts about the draft", () => {
  const done = completionOf({
    media: { portrait: { role: "portrait", ref: "x" } },
    identity: { name: "Ada", description: "tall" },
    persona: { personality: "wry" },
    greetings: { firstMessage: "hey" },
    discovery: { tags: ["fantasy"] },
  });
  expect(done).toEqual({ portrait: true, name: true, corePrompts: true, greeting: true, tags: true });
  const empty = completionOf({});
  expect(Object.values(empty).every((v) => v === false)).toBe(true);
});

test("EDITOR_CARDS registry is well-formed: unique ids, known steps, non-empty paths", () => {
  const ids = EDITOR_CARDS.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const c of EDITOR_CARDS) {
    expect((STEP_ORDER as readonly string[]).includes(c.step)).toBe(true);
    expect(c.paths.length).toBeGreaterThan(0);
  }
});

test("writeOverridePath keeps blanks; inheritOverridePath deletes; hasOverridePath is presence", () => {
  const blank = writeOverridePath({}, "identity.description", "");
  expect(readPath(blank, "identity.description")).toBe("");
  expect(hasOverridePath(blank, "identity.description")).toBe(true);
  const emptyArr = writeOverridePath({}, "discovery.tags", []);
  expect(readPath(emptyArr, "discovery.tags")).toEqual([]);
  const inherited = inheritOverridePath(blank, "identity.description");
  expect(hasOverridePath(inherited, "identity.description")).toBe(false);
});

// Async save reconciliation.

test("reconcileAfterSave: no concurrent edit adopts accepted and is clean", () => {
  const submitted = { identity: { name: "Ada", description: "tall" } };
  const live = structuredClone(submitted);
  const r = reconcileAfterSave({ live, submitted });
  expect(r.dirty).toBe(false);
  expect(deepEq(r.current, submitted)).toBe(true);
  expect(deepEq(r.baseline, submitted)).toBe(true);
  // ownership: baseline is not an alias of live or submitted
  expect(r.baseline).not.toBe(live);
  expect(r.baseline).not.toBe(submitted);
  expect(r.current).not.toBe(live);
  expect(r.current).not.toBe(submitted);
});

test("reconcileAfterSave: nested canonical edit during save is retained and dirty", () => {
  const submitted = { identity: { name: "Ada", description: "tall" }, tags: ["a"] };
  const live = { identity: { name: "Ada", description: "taller" }, tags: ["a"] };
  const r = reconcileAfterSave({ live, submitted });
  expect(r.dirty).toBe(true);
  expect(r.current).toBe(live);
  expect(deepEq(r.current, live)).toBe(true);
  expect(deepEq(r.baseline, submitted)).toBe(true);
  // mutating baseline must not touch live
  (r.baseline as { identity: { description: string } }).identity.description = "mutated";
  expect(live.identity.description).toBe("taller");
});

test("reconcileAfterSave: blank and deletion during save are retained", () => {
  const submitted = { identity: { name: "Ada", description: "keep" }, persona: { personality: "wry" } };
  const liveBlank = { identity: { name: "Ada", description: "" }, persona: { personality: "wry" } };
  const blank = reconcileAfterSave({ live: liveBlank, submitted });
  expect(blank.dirty).toBe(true);
  expect(blank.current).toBe(liveBlank);

  const liveDelete = { identity: { name: "Ada" }, persona: { personality: "wry" } };
  const deleted = reconcileAfterSave({ live: liveDelete, submitted });
  expect(deleted.dirty).toBe(true);
  expect(deleted.current).toBe(liveDelete);
  expect("description" in (deleted.current as { identity: object }).identity).toBe(false);
});

test("reconcileAfterSave: array reorder during save is retained", () => {
  const submitted = { discovery: { tags: ["a", "b", "c"] } };
  const live = { discovery: { tags: ["c", "a", "b"] } };
  const r = reconcileAfterSave({ live, submitted });
  expect(r.dirty).toBe(true);
  expect(r.current).toBe(live);
  expect(deepEq(r.baseline, submitted)).toBe(true);
});

test("reconcileAfterSave: accepted override becomes baseline when live matches submitted", () => {
  const submitted = { identity: { name: "Ada" } };
  const live = { identity: { name: "Ada" } };
  const accepted = { identity: { name: "Ada" }, schemaVersion: 1 };
  const r = reconcileAfterSave({ live, submitted, accepted });
  expect(r.dirty).toBe(false);
  expect(deepEq(r.current, accepted)).toBe(true);
  expect(deepEq(r.baseline, accepted)).toBe(true);
});

test("reconcileAfterSave: order domain uses the same helper", () => {
  const submitted = ["description", "personality", "scenario"];
  const live = ["personality", "description", "scenario"];
  const r = reconcileAfterSave({ live, submitted });
  expect(r.dirty).toBe(true);
  expect(r.current).toEqual(live);
  expect(r.baseline).toEqual(submitted);
  expect(r.baseline).not.toBe(submitted);
});

test("saveOutcomeStatus distinguishes clean vs still-dirty success", () => {
  expect(saveOutcomeStatus("Ada", false)).toBe("Ada saved");
  expect(saveOutcomeStatus("Ada", true)).toBe("Ada saved; newer changes not yet saved");
});
