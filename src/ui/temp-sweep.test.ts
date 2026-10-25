/** The temp sweep (temp-sweep.ts): stale Bunraku leftovers go, fresh ones and anything else stay. */
import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepStaleTemp } from "./temp-sweep";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("removes Bunraku's temp leftovers older than a day, and keeps fresh ones and other programs' files", () => {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-sweep-test-"));
  dirs.push(dir);
  const old = (Date.now() - 2 * 24 * 60 * 60_000) / 1000;
  const make = (name: string, stale: boolean, folder = true) => {
    const path = join(dir, name);
    if (folder) {
      mkdirSync(path);
      writeFileSync(join(path, "row-0.json"), "x");
    } else writeFileSync(path, "x");
    if (stale) utimesSync(path, old, old);
    return path;
  };
  const staleStaged = make("bunraku-lvbak-staged-abc", true);
  const staleLargeImport = make("bunraku-import-staged-abc", true);
  const stalePaste = make("kit-paste-1.png", true, false);
  const freshStaged = make("bunraku-lvbak-staged-live", false);
  const someoneElse = make("other-app-cache", true);
  expect(sweepStaleTemp(dir)).toBe(3);
  expect(existsSync(staleStaged)).toBe(false);
  expect(existsSync(staleLargeImport)).toBe(false);
  expect(existsSync(stalePaste)).toBe(false);
  expect(existsSync(freshStaged)).toBe(true);
  expect(existsSync(someoneElse)).toBe(true);
});

test("a missing temp folder is not an error", () => {
  expect(sweepStaleTemp(join(tmpdir(), "bunraku-no-such-folder-xyz"))).toBe(0);
});
