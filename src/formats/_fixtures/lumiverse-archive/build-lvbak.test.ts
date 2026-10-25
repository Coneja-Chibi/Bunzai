/**
 * Ground truth for the .lvbak fixture toolkit: every builder must produce an archive that a normal
 * ZIP reader can open, in real-export entry order, with the compression methods the spec
 * claims. Row shapes and variants are proved by the importer tests that read them.
 */
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import {
  PNG_1X1,
  SKIPPED_TABLE_COUNTS,
  buildCrossLinksLvbak,
  buildMinimalLvbak,
} from "./build-lvbak";
import { materializeLvbak, removeMaterialized } from "./materialize";
import {
  CHARACTER_AVATAR,
  PERSONA_AVATAR,
} from "./rows";

const STORED = 0;
const DEFLATE = 8;

interface Listed {
  name: string;
  compression: number;
  originalSize: number;
}

/** Entry metadata in archive order. The filter returns false, so nothing is inflated. */
const listing = (bytes: Uint8Array): Listed[] => {
  const seen: Listed[] = [];
  unzipSync(bytes, {
    filter: (f) => {
      seen.push({ name: f.name, compression: f.compression, originalSize: f.originalSize });
      return false;
    },
  });
  return seen;
};

const text = (bytes: Uint8Array, name: string): string => {
  const entry = unzipSync(bytes, { filter: (f) => f.name === name })[name];
  if (!entry) throw new Error(`fixture is missing entry ${name}`);
  return strFromU8(entry);
};

const json = (bytes: Uint8Array, name: string): Record<string, unknown> =>
  JSON.parse(text(bytes, name)) as Record<string, unknown>;

describe("lvbak fixture layout", () => {
  test("minimal: manifest first, manifest-stats last, expected entries between", () => {
    const names = listing(buildMinimalLvbak()).map((e) => e.name);
    expect(names[0]).toBe("manifest.json");
    expect(names[names.length - 1]).toBe("manifest-stats.json");
    expect(names).toContain("database/characters.ndjson");
    expect(names).toContain("database/world_books.ndjson");
    expect(names).toContain("database/world_book_entries.ndjson");
    expect(names).toContain("database/presets.ndjson");
    expect(names).toContain("database/personas.ndjson");
    expect(names).toContain("database/regex_scripts.ndjson");
    expect(names).toContain(`files/avatars/${CHARACTER_AVATAR}`);
    expect(names).toContain(`files/avatars/${PERSONA_AVATAR}`);
    // database entries precede the files tree, the order a real export writes
    const lastDb = names.findLastIndex((n) => n.startsWith("database/"));
    const firstFile = names.findIndex((n) => n.startsWith("files/"));
    expect(lastDb).toBeLessThan(firstFile);
  });

  test("minimal: NDJSON deflates, binaries are stored", () => {
    for (const entry of listing(buildMinimalLvbak())) {
      const expected = entry.name.startsWith("files/") ? STORED : DEFLATE;
      expect([entry.name, entry.compression]).toEqual([entry.name, expected]);
    }
  });

  test("builds are byte stable", () => {
    expect(buildMinimalLvbak()).toEqual(buildMinimalLvbak());
    expect(buildCrossLinksLvbak()).toEqual(buildCrossLinksLvbak());
  });

  test("minimal: manifest placeholders are empty, stats carry the real counts", () => {
    const bytes = buildMinimalLvbak();
    const manifest = json(bytes, "manifest.json");
    expect(manifest.producer).toBe("lumiverse");
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.ndjsonFormatVersion).toBe(1);
    expect(manifest.counts).toEqual({});
    expect(manifest.missingFiles).toEqual([]);

    const stats = json(bytes, "manifest-stats.json");
    const counts = stats.counts as Record<string, number>;
    expect(counts.characters).toBe(1);
    expect(counts.world_book_entries).toBe(1);
    // skipped tables are counted too, so the report can name what did not come along
    expect(counts.chats).toBe(SKIPPED_TABLE_COUNTS.chats);
    expect(stats.missingFiles).toEqual([]);
  });
});

describe("materializeLvbak", () => {
  test("unpacks an archive into a directory with identical bytes", async () => {
    const bytes = buildMinimalLvbak();
    const root = await materializeLvbak(bytes);
    try {
      const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8")) as {
        producer: string;
      };
      expect(manifest.producer).toBe("lumiverse");
      const avatar = await readFile(join(root, "files", "avatars", CHARACTER_AVATAR));
      expect(new Uint8Array(avatar)).toEqual(PNG_1X1);
      const ndjson = await readFile(join(root, "database", "characters.ndjson"), "utf8");
      expect(ndjson).toBe(text(bytes, "database/characters.ndjson"));
    } finally {
      await removeMaterialized(root);
    }
  });
});
