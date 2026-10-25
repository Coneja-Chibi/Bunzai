/**
 * Risu named-assets bridge: write additionalAssets, keep raw/extension siblings, immutable input.
 */
import { describe, expect, test } from "bun:test";
import { namedFromRisuAdditional, namedFromRisuOriginal, originalWithNamed, risuAdditionalFromNamed } from "./risu-named";

describe("risu-named bridge", () => {
  test("originalWithNamed updates runtime + raw.risuai assets and keeps siblings", () => {
    const original = {
      risu: {
        note: "keep",
        additionalAssets: [["old", "data:old", "bin"]] as [string, string, string][],
        raw: {
          data: {
            name: "Card",
            extensions: {
              other: 1,
              risuai: {
                triggerscript: ["x"],
                additionalAssets: [["old", "data:old", "bin"]],
              },
            },
          },
        },
      },
    };
    const frozen = structuredClone(original);
    const next = originalWithNamed(original, {
      items: [{ id: "n1", name: "bgm", ref: "data:audio/mp3;base64,aa", kind: "audio", ext: "mp3" }],
    });
    const risu = (next as { risu: Record<string, unknown> }).risu;
    expect(risu.note).toBe("keep");
    expect(risu.additionalAssets).toEqual([["bgm", "data:audio/mp3;base64,aa", "mp3"]]);
    const raw = risu.raw as {
      data: { name: string; extensions: { other: number; risuai: Record<string, unknown> } };
    };
    expect(raw.data.name).toBe("Card");
    expect(raw.data.extensions.other).toBe(1);
    expect(raw.data.extensions.risuai.triggerscript).toEqual(["x"]);
    expect(raw.data.extensions.risuai.additionalAssets).toEqual([
      ["bgm", "data:audio/mp3;base64,aa", "mp3"],
    ]);
    expect(original).toEqual(frozen);
  });

  test("B22: a dotless name with no explicit ext column never becomes its own extension", () => {
    // row[2] (ext) is absent, and the name has no dot. A naive `name.split(".").pop()` returns the
    // whole name for a dotless string (never undefined), so a fallback gated on that call never
    // fires - the bug this pins.
    const bag = namedFromRisuAdditional([["soundtrack", "data:audio/mp3;base64,aa"]]);
    expect(bag.items[0]?.name).toBe("soundtrack");
    expect(bag.items[0]?.ext).toBeUndefined();
  });

  test("B22: the write-back side has the same guard, falling back to \"bin\" instead of the name", () => {
    const rows = risuAdditionalFromNamed({
      items: [{ id: "n1", name: "soundtrack", ref: "data:audio/mp3;base64,aa", kind: "audio" }],
    });
    expect(rows[0]![2]).toBe("bin");
  });

  test("namedFromRisuOriginal reads runtime additionalAssets", () => {
    const bag = namedFromRisuOriginal({
      risu: {
        additionalAssets: [["bgm", "data:x", "mp3"]],
      },
    });
    expect(bag.items).toHaveLength(1);
    expect(bag.items[0]?.name).toBe("bgm");
  });
});
