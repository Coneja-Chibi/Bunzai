/** The glossary check's rules: named paths must exist, and every src/ folder must be explained. */
import { expect, test } from "bun:test";
import { glossaryProblems, pathsNamed } from "./glossary-core";

test("finds repo paths in backticks, dropping a trailing slash and skipping patterns and other code", () => {
  const page = "See `src/core/`, `docs/02-ARCHITECTURE.md`, `src/formats/<name>/`, `fake-*.ts`, `bun run x`, and `original`.";
  expect(pathsNamed(page)).toEqual(["docs/02-ARCHITECTURE.md", "src/core"]);
});

test("a named path that does not exist is a problem", () => {
  const exists = (p: string) => p === "src/core";
  expect(glossaryProblems("`src/core/` and `src/gone.ts`", exists, ["core"])).toEqual([
    "names `src/gone.ts`, which does not exist; update the entry or remove it",
  ]);
});

test("a folder under src/ that the page never names is a problem", () => {
  expect(glossaryProblems("`src/core/`", () => true, ["core", "stage"])).toEqual([
    'does not explain `src/stage/`; add it to "Where things live"',
  ]);
});

test("a page that names everything that exists has no problems", () => {
  expect(glossaryProblems("`src/core/` `src/stage/`", () => true, ["core", "stage"])).toEqual([]);
});
