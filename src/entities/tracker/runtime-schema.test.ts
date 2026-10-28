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
