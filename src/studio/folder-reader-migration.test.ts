/**
 * The folder import reading entities that were written by an older or foreign writer.
 *
 * Four real regex sets sat unreadable in a live studio because their `schemaVersion` was the number
 * 1 while the decoder wanted the string "1". Nothing else about them differed, every rule was
 * intact, and the app called them "corrupt entity file" with no field named - so there was no way
 * to know that one JSON type was the entire problem.
 *
 * Tolerance lives HERE, at the read-from-disk boundary, and deliberately not inside
 * parseCanonicalEntity: the converters and the capability preview parse on the WRITE path, where a
 * wrong shape is a Bunzai bug that must still fail loudly.
 */
import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readStudioFolder, type FolderRead } from "./folder-reader";
import { parseStoredEntity } from "./stored-entity";
import { withTempDir } from "./test-temp-dir";

const regexEntity = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  schemaVersion: "1",
  kind: "regex",
  id: "cleanup",
  body: { name: "Chat Cleanup", rules: [] },
  ...overrides,
});

async function studioWith<T>(file: Record<string, unknown> | string, run: (read: FolderRead) => Promise<T>): Promise<T> {
  return withTempDir("studio-migration-", async (dir) => {
    await mkdir(join(dir, "regex"), { recursive: true });
    await writeFile(join(dir, "regex", "cleanup.json"), typeof file === "string" ? file : JSON.stringify(file));
    return run(await readStudioFolder(dir));
  });
}

describe("stored entities that drifted are read, not condemned", () => {
  test("a numeric schemaVersion loads with its content intact", async () => {
    await studioWith(regexEntity({
      schemaVersion: 1,
      body: {
        name: "Chat Cleanup",
        rules: [{
          id: "r1",
          label: "Trim",
          find: "a",
          flags: "g",
          replace: "b",
          phases: ["response"],
          enabled: true,
          sortOrder: 0,
        }],
      },
    }), async (read) => {
      const entity = read.pieces[0]?.entity as { body?: { name?: string; rules?: unknown[] } };
      expect(entity.body?.name).toBe("Chat Cleanup");
      expect(entity.body?.rules).toHaveLength(1);
      expect(read.damaged).toEqual([]);
    });
  });

  test("the legacy escrow key is still carried across to original", async () => {
    await studioWith({
      ...regexEntity({}),
      escrow: { sillytavern: { raw: { kept: true } } },
    }, async (read) => {
      const entity = read.pieces[0]?.entity as { original?: Record<string, unknown> };
      expect(entity.original?.["sillytavern"]).toEqual({ raw: { kept: true } } as never);
    });
  });
});

describe("what a genuinely broken file reports", () => {
  test("the failure names the field instead of only saying corrupt", async () => {
    // The message is the difference between a user filing a useful report and saying "it says it
    // is broken", which is exactly what happened.
    const broken = regexEntity({ body: { name: 42, rules: [] } });
    await studioWith(broken, async (read) => {
      expect(read.damaged).toHaveLength(1);
      expect(() => parseStoredEntity(JSON.stringify(broken), "regex", "cleanup")).toThrow(/body\.name/);
    });
  });

  test("a file that is not JSON at all is still refused", async () => {
    await studioWith("{not json", async (read) => {
      expect(read.damaged[0]?.reason).toBe("unreadable-json");
    });
  });
});
