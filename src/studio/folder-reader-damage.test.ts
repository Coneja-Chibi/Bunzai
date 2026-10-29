/**
 * What the folder import SAYS about a file it will not bring in (folder-reader.ts).
 *
 * A real studio put 145 files behind this notice and the message on 123 of them was the word
 * `undefined`; the rest said the files did not match a data version, which was not true either.
 * These tests are about the sentence, because the sentence is the entire product here - the file is
 * on disk and unchanged, and the only thing Bunzai actually delivers is an accurate reason.
 */
import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readStudioFolder } from "./folder-reader";
import { withTempDir } from "./test-temp-dir";

async function studioWith(dir: string, files: Record<string, string>): Promise<void> {
  await mkdir(join(dir, "preset"), { recursive: true });
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, "preset", name), body);
}

/** A canonical preset as it is actually stored. */
const canonical = (id: string): string =>
  JSON.stringify({
    schemaVersion: "1",
    kind: "preset",
    id,
    body: { name: "Ours", prompts: [] },
  });

describe("the reason a file is not listed", () => {
  test("A NAME THAT CANNOT BE AN ID, on a file that is otherwise ours, says so", async () => {
    /**
     * The case that started this: a 2.4MB character called `ludovic-&-levi.json`. Perfectly good
     * work, refused for one ampersand, and reported with a word that meant nothing.
     */
    await withTempDir("bunzai-damage-", async (dir) => {
      await studioWith(dir, { "my &preset.json": canonical("my-preset") });
      const { damaged, pieces: entities } = await readStudioFolder(dir);
      expect(entities).toHaveLength(0);
      expect(damaged).toHaveLength(1);
      expect(damaged[0]?.reason).toBe("unusable-filename");
    });
  });

  test("A BADLY NAMED FILE THAT IS NOT OURS IS NOT TOLD TO RENAME ITSELF", async () => {
    /**
     * The distinction this file exists for. Both files have names an id cannot hold, so both used to
     * report identically - and the advice attached to that reason is "rename it", which is real for
     * the case above and a wild goose chase for this one. Renaming this file changes nothing: no
     * format here recognises a numeric-keyed map, which is the shape four of the leftovers in a real
     * studio actually had.
     */
    await withTempDir("bunzai-damage-", async (dir) => {
      await studioWith(dir, {
        "Loggo's Preset (13-06).json": JSON.stringify({ "0": "a", "1": "b", "2": "c" }),
      });
      const { damaged } = await readStudioFolder(dir);
      expect(damaged).toHaveLength(1);
      expect(damaged[0]?.reason).not.toBe("unusable-filename");
      expect(damaged[0]?.reason).toBe("schema-mismatch");
    });
  });

  test("a file that is not JSON at all is still reported, never skipped", async () => {
    // Reported rather than dropped: the inventory that silently skipped these is why a folder of
    // 147 presets listed three and said nothing about the other 144.
    await withTempDir("bunzai-damage-", async (dir) => {
      await studioWith(dir, { "broken.json": "{ not json" });
      const { damaged } = await readStudioFolder(dir);
      expect(damaged).toHaveLength(1);
      expect(damaged[0]?.reason).toBe("unreadable-json");
    });
  });
});
