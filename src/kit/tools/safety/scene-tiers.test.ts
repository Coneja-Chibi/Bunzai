/**
 * The scene tier table (scene-tiers.ts): it covers every Compendium access level and agrees with the functions the passes call,
 * every scene action has a tier, and each Compendium action that writes is gated where it runs.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { stripComments } from "../../../../scripts/hooks/lib";
import { ACCESS_LEVELS, canRead, canWrite } from "../../../core/compendium/defaults";
import { COMPENDIUM_ACCESS_TIERS, SCENE_ACTION_TIERS, type SceneAction } from "./scene-tiers";

describe("Compendium access levels on Kit tiers", () => {
  test("the table has exactly the levels the store accepts", () => {
    expect(Object.keys(COMPENDIUM_ACCESS_TIERS).sort()).toEqual([...ACCESS_LEVELS].sort());
  });

  test("canRead and canWrite say what the table says", () => {
    for (const level of ACCESS_LEVELS) {
      expect(canRead(level)).toBe(COMPENDIUM_ACCESS_TIERS[level].reads);
      expect(canWrite(level)).toBe(COMPENDIUM_ACCESS_TIERS[level].tier === "write");
    }
  });

  test("only the three tiers a book can hold are used, and off holds none", () => {
    const tiers = Object.values(COMPENDIUM_ACCESS_TIERS).map((t) => t.tier);
    expect(tiers.every((t) => t === null || t === "read" || t === "write")).toBe(true);
    expect(COMPENDIUM_ACCESS_TIERS.off).toEqual({ tier: null, reads: false });
  });
});

describe("scene actions", () => {
  test("each action is on a tier, and the two that spend or send are not read", () => {
    expect(SCENE_ACTION_TIERS["spotify.control"]).toBe("egress");
    expect(SCENE_ACTION_TIERS["narrator.lookup"]).toBe("read");
    expect(SCENE_ACTION_TIERS["tracker.generate"]).toBe("draft");
    expect(SCENE_ACTION_TIERS["tracker.refresh"]).toBe("draft");
    expect(SCENE_ACTION_TIERS["finalcut.rewrite"]).toBe("write");
  });

  test("the Story Director's plan and edits are at the write tier (what they do is enforced in scene-director-tier.test.ts)", () => {
    expect(SCENE_ACTION_TIERS["director.plan"]).toBe("write");
    expect(SCENE_ACTION_TIERS["director.edit"]).toBe("write");
  });

  test("a Dramaturg question is at the write tier: it writes the Dramaturg's own conversation and nothing else (enforced in scene-dramaturg.test.ts)", () => {
    expect(SCENE_ACTION_TIERS["dramaturg.ask"]).toBe("write");
  });

  test("every Compendium action at the write tier is gated by the book's write access where it runs", () => {
    const WHERE: Partial<Record<SceneAction, string>> = {
      "compendium.filing": "src/studio/compendium-filing.ts",
      "compendium.historian": "src/studio/compendium-historian.ts",
      "compendium.tree": "src/studio/compendium-tree.ts",
      "compendium.standardize": "src/studio/compendium-standardize.ts",
      "compendium.ingest": "src/studio/compendium-ingest.ts",
      "compendium.reconcile": "src/studio/compendium-reconcile.ts",
    };
    const writes = (Object.keys(SCENE_ACTION_TIERS) as SceneAction[]).filter((a) => a.startsWith("compendium.") && SCENE_ACTION_TIERS[a] === "write");
    expect(writes.filter((a) => !WHERE[a])).toEqual([]);
    expect(writes.filter((a) => !/\b(canWrite|writable)\b/.test(stripComments(readFileSync(WHERE[a]!, "utf8"))))).toEqual([]);
  });
});
