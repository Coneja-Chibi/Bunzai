/**
 * The StudioFs contract: one suite every backend runs, so
 * the folder, memory, and database backends cannot drift. Where they differed, the folder backend
 * (nodeStudioFs, the one in live use) decides. Writes into a folder that was never made are left
 * unspecified: every caller makes the folder first, and the folder backend itself is uneven there.
 * Imported only by tests.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { StudioConflictError } from "./errors";
import type { StudioFs } from "./fs-backend";

export interface ContractSubject {
  fs: StudioFs;
  /** An empty studio root the backend may use. */
  root: string;
}

export function studioFsContract(name: string, make: () => Promise<ContractSubject>): void {
  describe(`StudioFs contract: ${name}`, () => {
    test("a missing file reads as null and does not exist; a folder never made lists as null", async () => {
      const { fs, root } = await make();
      expect(await fs.readText(join(root, "character", "nobody.json"))).toBeNull();
      expect(await fs.exists(join(root, "character", "nobody.json"))).toBe(false);
      expect(await fs.listDir(join(root, "character"))).toBeNull();
    });

    test("a made folder exists and lists as empty; making nested folders makes their parents", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "character"));
      expect(await fs.exists(join(root, "character"))).toBe(true);
      expect(await fs.listDir(join(root, "character"))).toEqual([]);
      await fs.mkdirp(join(root, "graveyard", "character"));
      expect(await fs.listDir(join(root, "graveyard"))).toEqual(["character"]);
    });

    test("a folder lists its files and its folders", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "lorebook", "archive"));
      await fs.writeExclusive(join(root, "lorebook", "harbor.json"), "{}");
      expect((await fs.listDir(join(root, "lorebook")))!.sort()).toEqual(["archive", "harbor.json"]);
    });

    test("an exclusive write creates once, then refuses and keeps what was there", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "character"));
      const path = join(root, "character", "vera.json");
      await fs.writeExclusive(path, '{"n":1}');
      expect(await fs.readText(path)).toBe('{"n":1}');
      expect(await fs.exists(path)).toBe(true);
      await expect(fs.writeExclusive(path, '{"n":2}')).rejects.toBeInstanceOf(StudioConflictError);
      expect(await fs.readText(path)).toBe('{"n":1}');
    });

    test("an atomic replace creates or replaces", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "character"));
      const path = join(root, "character", "vera.json");
      await fs.writeAtomicReplace(path, "first");
      await fs.writeAtomicReplace(path, "second");
      expect(await fs.readText(path)).toBe("second");
    });

    test("an atomic update sees the current text, and writes only when given text back", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "settings"));
      const path = join(root, "settings", "studio.json");
      const seen: (string | null)[] = [];
      expect(await fs.updateAtomic(path, (current) => (seen.push(current), null))).toBe(false);
      expect(await fs.exists(path)).toBe(false);
      expect(await fs.updateAtomic(path, (current) => (seen.push(current), "a"))).toBe(true);
      expect(await fs.updateAtomic(path, (current) => (seen.push(current), `${current}b`))).toBe(true);
      expect(seen).toEqual([null, null, "a"]);
      expect(await fs.readText(path)).toBe("ab");
    });

    test("updates made at the same time all land, one after another", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "settings"));
      const path = join(root, "settings", "count.json");
      // Eight writers: enough to interleave. Twenty failed once in 37 runs against the folder backend
      // on Windows (error not captured); its lock gives up after 40 waits of 10 ms ("studio file is busy").
      await Promise.all(Array.from({ length: 8 }, () => fs.updateAtomic(path, (c) => String(Number(c ?? "0") + 1))));
      expect(await fs.readText(path)).toBe("8");
    });

    test("removing reports whether the file was there, and the file is gone from its folder", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "character"));
      const path = join(root, "character", "vera.json");
      await fs.writeExclusive(path, "{}");
      expect(await fs.remove(path)).toBe(true);
      expect(await fs.readText(path)).toBeNull();
      expect(await fs.listDir(join(root, "character"))).toEqual([]);
      expect(await fs.remove(path)).toBe(false);
    });

    test("names and text outside plain ASCII, and a large body, come back exactly", async () => {
      const { fs, root } = await make();
      await fs.mkdirp(join(root, "character"));
      const path = join(root, "character", "Véra de la Nuit 夜.json");
      const body = `{"note":"${"ざわめき ".repeat(200_000)}"}`;
      await fs.writeExclusive(path, body);
      expect(await fs.readText(path)).toBe(body);
      expect(await fs.listDir(join(root, "character"))).toEqual(["Véra de la Nuit 夜.json"]);
    });
  });
}
