/** The default studio dir is named for this product, adopts nothing, and moves no one else's folder. */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDefaultStudioDir } from "./resolve-dir";
import { tempDirSync } from "./test-temp-dir";

const makeHome = () => tempDirSync("bunraku-home-");

describe("resolveDefaultStudioDir", () => {
  test("fresh machine: names Bunraku Studio and creates nothing", () => {
    const home = makeHome();
    expect(resolveDefaultStudioDir(home)).toBe(join(home, "Documents", "Bunraku Studio"));
    expect(existsSync(join(home, "Documents", "Bunraku Studio"))).toBe(false);
  });

  test("another app's studio folder is never adopted or moved", () => {
    const home = makeHome();
    const foreign = join(home, "Documents", "Vaude Studio");
    mkdirSync(join(foreign, "character"), { recursive: true });
    writeFileSync(join(foreign, "character", "vera.json"), "{}");

    const dir = resolveDefaultStudioDir(home);

    expect(dir).toBe(join(home, "Documents", "Bunraku Studio"));
    expect(existsSync(join(foreign, "character", "vera.json"))).toBe(true);
    expect(existsSync(join(dir, "character", "vera.json"))).toBe(false);
  });

  test("an existing Bunraku Studio is used as is", () => {
    const home = makeHome();
    const fresh = join(home, "Documents", "Bunraku Studio");
    mkdirSync(join(fresh, "character"), { recursive: true });
    writeFileSync(join(fresh, "character", "own.json"), "{}");

    expect(resolveDefaultStudioDir(home)).toBe(fresh);
    expect(existsSync(join(fresh, "character", "own.json"))).toBe(true);
  });
});
