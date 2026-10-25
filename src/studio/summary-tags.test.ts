/**
 * entityTags: what a piece is tagged, for the Library's search. A character keeps its tags under
 * discovery; every other kind on its body. Malformed tags are no tags, never an error: the listing
 * must not refuse a piece over them.
 */
import { describe, expect, test } from "bun:test";
import { entityTags } from "./summary";

const piece = (kind: string, body: unknown) => ({ kind, id: "x", schemaVersion: 1, body }) as never;

describe("entityTags", () => {
  test("a character's tags are its discovery tags", () => {
    expect(entityTags(piece("character", { discovery: { tags: ["tarot", "oracle"] }, tags: ["stray"] }))).toEqual(["tarot", "oracle"]);
  });

  test("any other kind's tags are its body tags", () => {
    expect(entityTags(piece("lorebook", { tags: ["harbor", "town"] }))).toEqual(["harbor", "town"]);
  });

  test("blank, non-text, or missing tags are dropped rather than refused", () => {
    expect(entityTags(piece("persona", { tags: ["kept", "", "  ", 3, null] }))).toEqual(["kept"]);
    expect(entityTags(piece("preset", { tags: "not a list" }))).toEqual([]);
    expect(entityTags(piece("preset", null))).toEqual([]);
  });
});
