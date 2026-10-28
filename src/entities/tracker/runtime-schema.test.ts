/** The tracker decoder: what a stored tracker may hold, and each way one is refused. */
import { describe, expect, test } from "bun:test";
import { safeParseCanonicalEntity } from "../runtime-schema";
import { SANITY_LIST, SANITY_NUMBER, SANITY_TEXT } from "../_shared/sanity";
import { emptyTrackerBody, type TrackerBody } from "./schema";

const body = (over: Partial<TrackerBody> = {}): TrackerBody => ({
  name: "Health", description: "Vera's body.", layout: "record", note: "Lower hp when she is hurt.",
  fields: [
    { name: "hp", description: "Hit points.", type: "number", min: 0, max: 100, default: 100 },
    { name: "mood", description: "How she feels.", type: "choice", choices: ["calm", "tense"], default: "calm" },
    { name: "hurt", description: "", type: "boolean" },
    { name: "wound", description: "", type: "text" },
  ],
  ...over,
});
const reads = (b: unknown): boolean => safeParseCanonicalEntity({ schemaVersion: "1", kind: "tracker", id: "t", body: b }).ok;
const field = (f: Record<string, unknown>) => body({ fields: [{ name: "x", description: "", type: "number", ...f } as never] });

describe("a tracker body", () => {
  test("valid bodies read: a record, a list, a template, and the blank one", () => {
    expect(reads(body())).toBe(true);
    expect(reads(body({ layout: "list", template: "{{char}} keeps {{tracker::Health::hp}}" }))).toBe(true);
    expect(reads(emptyTrackerBody("My tracker"))).toBe(true);
    expect(emptyTrackerBody("My tracker")).toMatchObject({ layout: "record", fields: [{ name: "value", type: "number", default: 0 }] });
  });

  test("each refusal", () => {
    const f = (name: string) => ({ name, description: "", type: "text" as const });
    expect(reads(body({ fields: [f("a"), f("a")] }))).toBe(false);
    expect(reads(body({ layout: "list", fields: [f("name")] }))).toBe(false);
    expect(reads(body({ layout: "record", fields: [f("name")] }))).toBe(true);
    expect(reads(field({ type: "text", choices: ["a"] }))).toBe(false);
    expect(reads(field({ type: "choice" }))).toBe(false);
    expect(reads(field({ type: "text", min: 1 }))).toBe(false);
    expect(reads(field({ min: 5, max: 1 }))).toBe(false);
    expect(reads(field({ min: 0, max: 10, default: 11 }))).toBe(false);
    expect(reads(field({ default: "7" }))).toBe(false);
    expect(reads(field({ type: "boolean", default: 1 }))).toBe(false);
    expect(reads(field({ type: "choice", choices: ["a", "b"], default: "c" }))).toBe(false);
    expect(reads(field({ type: "choice", choices: ["a", "b"], default: "b" }))).toBe(true);
    expect(reads(field({ type: "choice", choices: ["a", "a"] }))).toBe(false);
    expect(reads(body({ fields: [] }))).toBe(false);
    // owner rule (limits rework): 12 fields, a 2,000-character note and a 4,000-character template were product limits; only a hostile file is refused now
    expect(reads(body({ fields: Array.from({ length: 40 }, (_, i) => f(`f${i}`)) }))).toBe(true);
    expect(reads(body({ fields: Array.from({ length: SANITY_LIST + 1 }, (_, i) => f(`f${i}`)) }))).toBe(false);
    expect(reads(body({ template: "x".repeat(50_000), note: "n".repeat(50_000) }))).toBe(true);
    expect(reads(body({ template: "x".repeat(SANITY_TEXT + 1) }))).toBe(false);
    expect(reads(body({ note: "x".repeat(SANITY_TEXT + 1) }))).toBe(false);
    expect(reads(field({ min: -5e9, max: 5e9, default: 3e9 }))).toBe(true);
    expect(reads(field({ default: SANITY_NUMBER + 2 }))).toBe(false);
    expect(reads(field({ name: "a".repeat(64) }))).toBe(true);
    expect(reads(field({ name: "a".repeat(65) }))).toBe(false);
    // a field named like an inherited property is only ever a field (the decoder refuses names that start with an underscore or a capital)
    for (const name of ["constructor", "tostring", "valueof"]) expect(reads(field({ name })), name).toBe(true);
    for (const name of ["__proto__", "toString", "prototype_", "_hidden"]) expect(reads(field({ name })), name).toBe(name === "prototype_" ? true : false);
    expect(reads(body({ layout: "grid" as never }))).toBe(false);
    expect(reads(field({ name: "Bad Name" }))).toBe(false);
    expect(reads({ ...body(), extra: 1 })).toBe(false);
  });
});

describe("a tracker's icons", () => {
  test("a tracker and a field take a well-formed icon id, known to the build or not; a malformed one is refused", () => {
    for (const ok of ["lucide:gauge", "mdi:drama-masks", "lucide:a-glyph-this-build-lacks"]) {
      expect(reads(body({ icon: ok })), ok).toBe(true);
      expect(reads(field({ icon: ok })), ok).toBe(true);
    }
    for (const bad of ["gauge", "", "other:gauge", "lucide:", "lucide:Gauge", "lucide:a b", " lucide:gauge", "lucide:gauge\n", "constructor", "__proto__", "x".repeat(SANITY_TEXT + 1), 7, null]) {
      expect(reads(body({ icon: bad as never })), String(bad)).toBe(false);
      expect(reads(field({ icon: bad as never })), String(bad)).toBe(false);
    }
  });

  test("no icon is the same as none, and a tool's field takes no icon", () => {
    expect(reads(body())).toBe(true);
    const tool = { schemaVersion: "1", kind: "tool", id: "t", body: { name: "luck", description: "", action: { type: "dice", dice: "d6" }, fields: [{ name: "x", description: "", type: "text", icon: "lucide:gauge" }] } };
    expect(safeParseCanonicalEntity(tool).ok).toBe(false);
  });
});

describe("a number's top from another field", () => {
  const hp = { name: "hp", description: "", type: "number" as const };
  const hpMax = { name: "hp_max", description: "", type: "number" as const };
  const two = (a: Record<string, unknown>, b: Record<string, unknown> = {}) => body({ fields: [{ ...hp, ...a }, { ...hpMax, ...b }] as never });

  test("a number field may name another number field of the same tracker as its top", () => {
    expect(reads(two({ maxField: "hp_max" }))).toBe(true);
    expect(reads(two({ maxField: "hp_max", min: 0, default: 5 }))).toBe(true);
    expect(reads(body({ layout: "list", fields: [{ ...hp, maxField: "hp_max" }, hpMax] as never }))).toBe(true);
    // the default is not judged against the other field's default: it is brought inside the top when read
    expect(reads(two({ maxField: "hp_max", default: 50 }, { default: 20 }))).toBe(true);
  });

  test("each refusal", () => {
    expect(reads(two({ maxField: "nope" })), "missing").toBe(false);
    expect(reads(body({ fields: [{ ...hp, maxField: "mood" }, { name: "mood", description: "", type: "text" }] as never })), "text field").toBe(false);
    expect(reads(body({ fields: [{ ...hp, maxField: "mood" }, { name: "mood", description: "", type: "choice", choices: ["a"] }] as never })), "choice field").toBe(false);
    expect(reads(body({ fields: [{ ...hp, maxField: "flag" }, { name: "flag", description: "", type: "boolean" }] as never })), "boolean field").toBe(false);
    expect(reads(two({ maxField: "hp" })), "itself").toBe(false);
    expect(reads(two({ maxField: "hp_max" }, { maxField: "hp" })), "two in a loop").toBe(false);
    expect(reads(body({ fields: [{ ...hp, maxField: "b" }, { ...hpMax, name: "b", maxField: "c" }, { ...hpMax, name: "c", maxField: "a" }, { ...hpMax, name: "a", maxField: "hp" }] as never })), "a longer loop").toBe(false);
    expect(reads(body({ fields: [{ ...hp, maxField: "b" }, { ...hpMax, name: "b", maxField: "c" }, { ...hpMax, name: "c" }] as never })), "a chain is fine").toBe(true);
    expect(reads(two({ maxField: "hp_max", max: 10 })), "with a fixed top").toBe(false);
    expect(reads(body({ fields: [{ name: "wound", description: "", type: "text", maxField: "hp_max" }, hpMax] as never })), "on a text field").toBe(false);
    expect(reads(two({ maxField: "Hp_Max" })), "not a field name").toBe(false);
    expect(reads(two({ maxField: 3 })), "not text").toBe(false);
  });
});

describe("how a tracker shows changes", () => {
  test("chips, card, toast or hidden; absent is chips", () => {
    for (const changes of ["chips", "card", "toast", "hidden"]) expect(reads(body({ changes: changes as never })), changes).toBe(true);
    for (const bad of ["chip", "", "Card", 1, null, true]) expect(reads(body({ changes: bad as never })), String(bad)).toBe(false);
    expect(reads(body())).toBe(true);
  });
});
