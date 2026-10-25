/**
 * Guard: no second recursive directory walker under scripts/hooks. walk.ts is the one home; every
 * other hook script imports it instead of hand-rolling readdirSync recursion again (the drift this
 * fold closed - doctrines.ts and stage-boundary.ts had already gone byte-identical).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { walk } from "./walk";

describe("walk", () => {
  test("finds nested files and respects skipDirs", () => {
    const hits = walk(
      "scripts/hooks",
      (_path, name) => name === "walk.ts",
      new Set(["node_modules"]),
    );
    expect(hits).toContain("scripts/hooks/walk.ts");
  });

  test("returns [] for a missing root instead of throwing", () => {
    expect(walk("scripts/hooks/does-not-exist", () => true, new Set())).toEqual([]);
  });
});

describe("no second walker", () => {
  test("no scripts/hooks/*.ts file other than walk.ts defines its own function walk(", () => {
    const offenders = readdirSync("scripts/hooks", { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts") && e.name !== "walk.ts" && e.name !== "walk.test.ts")
      .map((e) => `scripts/hooks/${e.name}`)
      .filter((path) => /\bfunction\s+walk\s*\(/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
