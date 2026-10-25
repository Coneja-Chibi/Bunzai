/** The helpers index's pure rules: exported declaration discovery and stable rendering. */
import { expect, test } from "bun:test";
import { exportedNames, renderHelperPage, renderHelpersIndex } from "./helpers-core";

test("finds named declarations, including multiline functions and re-export aliases", () => {
  expect(exportedNames(`export function one(\n value: string,\n): string;\nexport type Shape = {};\nexport { oldName as publicName, type Local };\nconst hidden = 1;`)).toEqual(["Local", "one", "publicName", "Shape"]);
});

test("renders one sorted line per exported helper and groups the root index", () => {
  const entries = [
    { name: "zeta", path: "src/shared/z.ts" },
    { name: "alpha", path: "src/shared/a.ts" },
  ];
  expect(renderHelperPage("shared", entries)).toContain("- `alpha`: `src/shared/a.ts`\n- `zeta`: `src/shared/z.ts`");
  expect(renderHelpersIndex(new Map([["core", entries]]))).toContain("docs/generated/helpers/core.md");
});
