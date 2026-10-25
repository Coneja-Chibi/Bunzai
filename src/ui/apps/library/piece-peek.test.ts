/**
 * What a card may say about a piece. The rule under test is the one the preset strip depends on:
 * only values the piece carries are reported, so a card never prints an engine default as if the
 * preset had chosen it.
 */
import { describe, expect, test } from "bun:test";
import type { AppContext } from "../../app-contract";
import { peekPiece, sourceLabelFor } from "./piece-peek";

const ctxWith = (body: unknown, fail = false): AppContext =>
  ({
    api: {
      getEntity: () => (fail ? Promise.reject(new Error("423")) : Promise.resolve({ body })),
    },
  }) as unknown as AppContext;

const preset = { kind: "preset", id: "p", name: "P" };

describe("peekPiece", () => {
  test("a preset reports the samplers it carries and its block count, nothing it lacks", async () => {
    const peek = await peekPiece(
      ctxWith({ name: "P", description: "Case files.", prompts: [{}, {}, {}], samplers: { temperature: 1.3, topK: 0 } }),
      preset,
    );

    expect(peek?.samplers).toEqual({ temperature: 1.3, topK: 0 });
    expect(peek?.blocks).toBe(3);
    expect(peek?.description).toBe("Case files.");
  });

  test("a preset with no samplers says none, rather than printing defaults", async () => {
    const peek = await peekPiece(ctxWith({ name: "P", prompts: [] }), preset);

    expect(peek?.samplers).toBeUndefined();
    expect(peek?.blocks).toBe(0);
  });

  test("a character's words are its identity description, and they count toward its fields", async () => {
    // The shape an imported SillyTavern card actually lands in (entities/character/schema.ts).
    // This read persona.description, which no importer writes, so no card showed its words.
    const peek = await peekPiece(
      ctxWith({ identity: { name: "Vera", description: "Keeper of the lamp." }, persona: { personality: "dry" }, description: "stray" }),
      { kind: "character", id: "v", name: "Vera" },
    );

    expect(peek?.description).toBe("Keeper of the lamp.");
    expect(peek?.filled).toBe("3/9");
    expect(peek?.samplers).toBeUndefined();
    expect(peek?.blocks).toBeUndefined();
  });

  test("a failed read is null, not an empty peek", async () => {
    expect(await peekPiece(ctxWith(null, true), preset)).toBeNull();
  });
});

describe("sourceLabelFor", () => {
  const labels = new Map([["tavern", "Default"], ["rolecall", "RoleCall"]]);

  test("a generic character card is a CC of its spec version", () => {
    expect(sourceLabelFor(labels, { kind: "character", id: "v", name: "V", sourceFormat: "tavern", sourceVariant: "v2" })).toBe("CC V2");
  });

  test("CC is never printed on something that is not a character", () => {
    // Seen live: an imported SillyTavern preset wore a "CC" edition tag.
    expect(sourceLabelFor(labels, { kind: "preset", id: "p", name: "P", sourceFormat: "tavern" })).toBeNull();
  });

  test("a named platform is named on any kind", () => {
    expect(sourceLabelFor(labels, { kind: "lorebook", id: "b", name: "B", sourceFormat: "rolecall", sourceVariant: "v3" })).toBe("RoleCall · V3");
  });
});
