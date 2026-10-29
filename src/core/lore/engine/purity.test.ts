/**
 * Purity gate (Bunzai change 2 + AGENTS.md rule 1): no Math.random, Date.now, or console.* in any
 * non-test source file under engine/. Every random draw takes the injected rng; every clock read
 * takes LoreScan.now. This is a source grep, not a runtime mock check, so it also blocks the
 * literal tokens showing up in comments - write around them if you need to name what RoleCall did.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ENGINE_DIR = join(import.meta.dir);
const BANNED = [/Math\.random/, /Date\.now/, /console\./];

function sourceFiles(): string[] {
  return readdirSync(ENGINE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(ENGINE_DIR, f));
}

describe("engine/*.ts purity", () => {
  for (const file of sourceFiles()) {
    test(`${file.split(/[\\/]/).pop()} has no Math.random, Date.now, or console.*`, () => {
      const text = readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        expect(pattern.test(text)).toBe(false);
      }
    });
  }
});
