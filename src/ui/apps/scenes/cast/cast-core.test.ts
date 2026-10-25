/** The Cast wing's pure rules (cast-core.ts): the tab bar, how a failed save reads, stats and pronoun lines, and the Casting Call's filter and grid. */
import { describe, expect, test } from "bun:test";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { CAST_TABS, filterPersonas, gridColumns, INJECTION_POSITIONS, noteForFailure, noteForSaved, prettyPronouns, RATING_CHOICES, statLines } from "./cast-core";

describe("the tab bar and RoleCall's fixed choices", () => {
  test("the tabs are RoleCall's, in order", () => expect(CAST_TABS.map((t) => t.label)).toEqual(["Character", "Persona", "Participants"]));
  test("the ratings and injection positions are RoleCall's words over the canonical grades", () => {
    expect(RATING_CHOICES.map((r) => [r.label, r.value])).toEqual([["All Hours", "all-ages"], ["Late Night", "mature"], ["After Dark", "explicit"]]);
    expect(INJECTION_POSITIONS.map((p) => p.value)).toEqual(["world", "character", "scene", "depth"]);
  });
});

describe("what a save says", () => {
  test("a 409 that names a reply being written is busy; any other 409 is stale; anything else is its own message", () => {
    expect(noteForFailure(new ApiHttpError(409, "a reply is being written in this scene, so its cast cannot change until it finishes"), "card").kind).toBe("busy");
    expect(noteForFailure(new ApiHttpError(409, "piece changed since it was opened"), "persona")).toMatchObject({ kind: "stale", text: expect.stringContaining("persona was changed in the Library") });
    expect(noteForFailure(new ApiHttpError(500, "boom"), "card")).toEqual({ kind: "failed", text: "boom" });
  });
  test("a save that moved the scene and one that could not are told apart", () => {
    expect(noteForSaved(5, true, "card")).toMatchObject({ kind: "saved" });
    expect(noteForSaved(5, false, "persona")).toMatchObject({ kind: "unapplied", text: expect.stringContaining("left on its old copy") });
  });
});

describe("persona lines", () => {
  test("stats group thousands and show a dash while unread", () => {
    expect(statLines({ messages: 12345, scenes: 6, streak: 0 }).map((s) => s.value)).toEqual(["12,345", "6", "0"]);
    expect(statLines(null).map((s) => s.value)).toEqual(["-", "-", "-"]);
  });
  test("pronouns are capitalised the way RoleCall shows them", () => {
    expect(prettyPronouns("they/them")).toBe("They / Them");
  });
});

describe("the Casting Call", () => {
  const all = [{ name: "Nuit", brief: "keeps a notebook" }, { name: "Corvin" }, { name: "Rue" }, { name: "Ines" }];
  test("search matches a name or a tagline, and an empty search lists everyone", () => {
    expect(filterPersonas(all, "cor").map((p) => p.name)).toEqual(["Corvin"]);
    expect(filterPersonas(all, "NOTEBOOK").map((p) => p.name)).toEqual(["Nuit"]);
    expect(filterPersonas(all, "  ")).toHaveLength(4);
  });
  test("the grid is 1, 2 or 3 across for few tiles and 4 across from four", () => {
    expect([0, 1, 2, 3, 4, 9].map(gridColumns)).toEqual([1, 1, 2, 3, 4, 4]);
  });
});
