/** Format-matrix coverage for registry kinds, empty kinds, and CLI examples. */
import { expect, test } from "bun:test";
import { matrixKinds, renderFormatMatrix } from "./format-matrix";

const A = (id: string, kind: string): { id: string; kind: string; outputExtensions: string[]; label: string } => ({
  id,
  kind,
  outputExtensions: ["json"],
  label: id,
});

test("matrixKinds unions entity kinds with adapter kinds, the kind hub's order first", () => {
  // the hub (src/entities/<kind>/kind.ts) orders pack before preset, as the Library does; unknown kinds sort after
  expect(matrixKinds(["character", "pack"], [A("x-preset", "preset"), A("y", "widget")])).toEqual([
    "character",
    "pack",
    "preset",
    "widget",
  ]);
});

test("every declared kind renders a section; empty kinds say (none yet)", () => {
  const adapters = [A("sillytavern", "character"), A("marinara-preset", "preset")] as never[];
  const md = renderFormatMatrix(adapters, "1", "2026-07-21", ["character", "preset", "pack"]);
  expect(md).toContain("## Characters (1)");
  expect(md).toContain("## Presets (1)");
  expect(md).toContain("`marinara-preset`");
  expect(md).toContain("## Packs (0)");
  expect(md).toContain("(none yet)");
  expect(md).toContain("bun run bunzai convert");
  expect(md).toContain("`bunzai label`");
  expect(md).not.toContain("bun run vaud");
});
