/**
 * Every program that serves the Studio hands its server the library and opens it.
 * A launcher that skips it finds library.db, never opens
 * it, and answers 423 to every request for good; the dev launcher shipped that way once. Like
 * src/disk-writes.test.ts, this reads the source, so a new launcher fails here until it is wired.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

/** Where the server's starters are defined, not called. */
const DEFINES = new Set(["src/ui/server.ts"]);
const STARTS = /\b(startUi|claimStudio)\(([^)]*)\)/g;

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

test("every file that starts the Studio server makes the library first, passes it in, and opens it", () => {
  const starters = sources("src").filter((f) => !DEFINES.has(f) && /\b(startUi|claimStudio)\(/.test(readFileSync(f, "utf8")));
  expect(starters.length).toBeGreaterThan(0);
  const unwired = starters.filter((f) => {
    const code = readFileSync(f, "utf8").replace(/^\s*(\/\/|\*).*$/gm, "");
    const made = code.search(/\bcreateLibrary\(/);
    const calls = [...code.matchAll(STARTS)].filter((m) => !/^\s*(async\s+)?function\b/.test(code.slice(code.lastIndexOf("\n", m.index) + 1, m.index)));
    return made < 0 || !/\.open\(\)/.test(code) || calls.some((m) => !/\blibrary\b/.test(m[2]!));
  });
  expect(unwired).toEqual([]);
});
