/**
 * Guard for file-order independence: every test file that installs a DOM through installDom must tear it down
 * (teardown or teardownAllDoms), because files in one `bun test` run share one process and a leaked window,
 * document or getComputedStyle changes what the next file sees. A file that only passes after another file's
 * leftovers fails this scan.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

test("every test file that calls installDom also tears it down", () => {
  const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const leaky: string[] = [];
  for (const rel of new Bun.Glob("**/*.test.{ts,tsx}").scanSync({ cwd: root })) {
    const source = readFileSync(`${root}${rel}`, "utf8");
    if (/\binstallDom\(/.test(source) && !/\bteardown(AllDoms)?\b/.test(source)) leaky.push(relative(root, `${root}${rel}`));
  }
  expect(leaky).toEqual([]);
});
