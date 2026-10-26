/** Regression coverage that every class used by the lore TOC card and bias editor is exported. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_CLASSES = [
  "eiActs",
  "eiBadgeC",
  "eiBadgeS",
  "eiCard",
  "eiChrom",
  "eiChromRead",
  "eiHash",
  "eiHead",
  "eiMode",
  "eiMoveLab",
  "eiMoveMenu",
  "eiMoveSep",
  "eiMoveWrap",
  "eiTitle",
  "pcBiasBias",
  "pcBiasCard",
  "pcBiasFlags",
  "pcBiasHead",
  "pcBiasPhrases",
  "pcBiasTa",
  "pcHint",
] as const;

test("binderStyles imports every class consumed by the focused TOC and NovelAI bias controls", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const binder = readFileSync(join(here, "binder-styles.ts"), "utf8");
  const classes = new Set<string>();
  for (const match of binder.matchAll(/from\s+"(.+\.module\.css)"/g)) {
    const css = readFileSync(join(here, match[1]!), "utf8");
    for (const selector of css.matchAll(/^\.([A-Za-z_][\w-]*)/gm)) classes.add(selector[1]!);
  }
  for (const name of REQUIRED_CLASSES) expect(classes.has(name), name).toBe(true);
});
