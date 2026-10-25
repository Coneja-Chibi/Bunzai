/** The code map's pure rules: which files it covers, how a purpose is read, and the page's shape. */
import { expect, test } from "bun:test";
import { onMap, purposeOf, renderCodeMap } from "./code-map-core";

test("covers authored source under src and scripts, never tests, generated code, or other folders", () => {
  expect(onMap("src/stage/crypto/keyring.ts")).toBe(true);
  expect(onMap("src/ui/App.tsx")).toBe(true);
  expect(onMap("scripts/perf-gate.ts")).toBe(true);
  expect(onMap(["src", "core", "canonical.ts"].join("\\"))).toBe(true);
  expect(onMap("src/stage/crypto/keyring.test.ts")).toBe(false);
  expect(onMap("src/generated/formats.ts")).toBe(false);
  expect(onMap("src/formats/x/fixtures/a.ts")).toBe(false);
  expect(onMap("src/types/bun.d.ts")).toBe(false);
  expect(onMap("templates/app/index.ts")).toBe(false);
  expect(onMap("src/ui/styles.css")).toBe(false);
});

test("a purpose is the first sentence of the opening comment, on one line", () => {
  const source = "/**\n * The keyring: the one data key.\n * Second sentence here.\n */\nexport {};";
  expect(purposeOf(source)).toBe("The keyring: the one data key.");
  expect(purposeOf("#!/usr/bin/env bun\n/** Runs the CLI. More. */")).toBe("Runs the CLI.");
  expect(purposeOf("/**\r\n * Windows line endings. Still fine.\r\n */")).toBe("Windows line endings.");
});

test("abbreviations and file names do not end a sentence early", () => {
  expect(purposeOf("/** Seals cells, e.g. bodies, via aes.ts before storage. Then more. */")).toBe(
    "Seals cells, e.g. bodies, via aes.ts before storage.",
  );
});

test("a comment with no sentence end is used whole, and a long one is cut", () => {
  expect(purposeOf("/** Wire sandbox origin into server.ts */")).toBe("Wire sandbox origin into server.ts");
  const long = purposeOf(`/** ${"word ".repeat(80)}*/`)!;
  expect(long.length).toBeLessThanOrEqual(220);
  expect(long.endsWith("...")).toBe(true);
});

test("a tag-only block before the real one is skipped, so JSX pragmas never blank a purpose", () => {
  expect(purposeOf("/** @jsxImportSource @opentui/react */\n/**\n * SayLine: an assistant reply.\n */")).toBe("SayLine: an assistant reply.");
  expect(purposeOf("/** @jsxImportSource @opentui/react */\nexport {};")).toBeNull();
});

test("no opening comment gives null, and tags are skipped", () => {
  expect(purposeOf("export const x = 1;")).toBeNull();
  expect(purposeOf("// a line comment\nexport {};")).toBeNull();
  expect(purposeOf("/**\n * @file\n * The real purpose.\n */")).toBe("The real purpose.");
});

test("the page groups files by folder in path order and is stable", () => {
  const page = renderCodeMap([
    { path: "src/b/two.ts", purpose: "Two." },
    { path: "src/a/one.ts", purpose: "One." },
    { path: "src/a/zero.ts", purpose: null },
  ]);
  expect(page).toContain("3 files.");
  expect(page.indexOf("## src/a/")).toBeLessThan(page.indexOf("## src/b/"));
  expect(page).toContain("- `one.ts`: One.");
  expect(page).toContain("- `zero.ts`: (no opening comment)");
  expect(renderCodeMap([{ path: "src/a/one.ts", purpose: "One." }])).toBe(renderCodeMap([{ path: "src/a/one.ts", purpose: "One." }]));
});
