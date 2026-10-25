/** Verifies the shared loader's stable, filtered filesystem walk without using Kit's real folders. */
import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDropIns } from "./drop-in-loader";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

test("loads accepted defaults in stable path order and only descends when requested", async () => {
  root = await mkdtemp(join(tmpdir(), "kit-drop-ins-"));
  await mkdir(join(root, "nested"));
  await writeFile(join(root, "z.ts"), 'export default { id: "z" };');
  await writeFile(join(root, "a.ts"), 'export default { id: "a" };');
  await writeFile(join(root, "skip.test.ts"), 'export default { id: "test" };');
  await writeFile(join(root, "nested", "b.ts"), 'export default { id: "b" };');
  const accept = (path: string): boolean => path.endsWith(".ts") && !path.endsWith(".test.ts");
  expect(await loadDropIns(root, accept)).toEqual([{ id: "a" }, { id: "z" }]);
  expect(await loadDropIns(root, accept, true)).toEqual([{ id: "a" }, { id: "b" }, { id: "z" }]);
});
