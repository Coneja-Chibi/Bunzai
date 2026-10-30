/**
 * What the folder import SAYS about a file it will not bring in (folder-reader.ts).
 *
 * These tests verify that rejected files receive accurate reasons and actionable guidance.
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
     * Filename validity and content validity are separate checks. A validly named file can still
     * have content that no supported format recognizes, so renaming cannot resolve that case.
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
    // Malformed JSON is reported in the inventory rather than silently skipped.
    await withTempDir("bunzai-damage-", async (dir) => {
      await studioWith(dir, { "broken.json": "{ not json" });
      const { damaged } = await readStudioFolder(dir);
      expect(damaged).toHaveLength(1);
      expect(damaged[0]?.reason).toBe("unreadable-json");
    });
  });
});
