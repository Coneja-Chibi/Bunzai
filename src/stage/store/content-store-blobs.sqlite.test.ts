/**
 * SQLite-only proof for the blob store, beside the
 * cross-backend contract in `content-store-blobs.contract.ts`: a swapped blob cell is caught, VACUUM
 * never strands a ref or leaves an orphan, an edit that leaves a piece's art alone seals and links
 * nothing new, and the remaining on-disk framing (now that `piece-part-text.ts`'s inline blob section
 * is gone) survives a multi-byte name and fails closed on a truncated or malformed cell.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { PresetPrompt } from "../../entities/preset/schema";
import { DamagedDataError } from "../crypto/crypto";
import type { StoredEntity } from "../contracts/content-store";
import { artDataUri, character, characterWithArt } from "../contracts/content-store.contract-fixtures";
import { createContentStore } from "./content-store";
import { openStageDatabase, type StageDatabase } from "./sqlite/database";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { MIGRATIONS } from "./sqlite/migrations";
import { testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** `characterWithArt`'s one portrait slot, read back through the union `StoredEntity.entity.body`
 * type (see the matching helper in `content-store-blobs.contract.ts`). */
const portraitRef = (read: StoredEntity | null): string | undefined =>
  (read?.entity.body as { media?: { portrait?: { ref: string } } } | undefined)?.media?.portrait?.ref;

/** An on-disk database: VACUUM (`rebuild()`) only means something on a real file. */
const onDisk = () => {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-blobs-"));
  dirs.push(dir);
  const d = openStageDatabase(join(dir, "bunraku.db"), MIGRATIONS);
  open.push(d);
  return d;
};

const prompt = (id: string): PresetPrompt => ({
  id,
  name: id,
  content: "x",
  role: "system",
  enabled: true,
  systemPrompt: false,
  marker: false,
  placement: "relative",
  injectionDepth: 0,
  injectionOrder: 0,
  forbidOverrides: false,
});

describe("SQLite blob store: identity and tamper detection", () => {
  test("a blob cell swapped between two blobs throws DamagedDataError on read", async () => {
    const d = onDisk();
    const backend = sqliteDocumentBackend(d, testCipher());
    const store = createContentStore(backend);
    await store.save(characterWithArt("a", artDataUri(1)));
    await store.save(characterWithArt("b", artDataUri(2)));

    const cells = d.db.query("SELECT key, cell FROM blobs ORDER BY key").all() as { key: string; cell: string }[];
    expect(cells).toHaveLength(2);
    d.db.query("UPDATE blobs SET cell = ? WHERE key = ?").run(cells[1]!.cell, cells[0]!.key);
    d.db.query("UPDATE blobs SET cell = ? WHERE key = ?").run(cells[0]!.cell, cells[1]!.key);

    await expect(store.read("character", "a")).rejects.toBeInstanceOf(DamagedDataError);
    await expect(store.read("character", "b")).rejects.toBeInstanceOf(DamagedDataError);
  });

  // These two corrupt the OPENED PLAINTEXT, then reseal it, rather than truncating the sealed cell
  // directly: a truncated ciphertext fails AES-GCM's own tag check inside `cipher.open` before the
  // framing below ever runs, which would prove nothing about `decodeBlobCell` (the coordinator's own
  // "framing-level malformed input" ask).
  test("an empty blobs cell throws DamagedDataError", async () => {
    const d = onDisk();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend);
    await store.save(characterWithArt("a", artDataUri()));

    const row = d.db.query("SELECT key FROM blobs LIMIT 1").get() as { key: string };
    d.db.query("UPDATE blobs SET cell = ? WHERE key = ?").run(cipher.seal("blobs.cell", ""), row.key);

    await expect(store.read("character", "a")).rejects.toBeInstanceOf(DamagedDataError);
  });

  test("an unknown payload-kind tag in a blobs cell throws DamagedDataError", async () => {
    const d = onDisk();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend);
    await store.save(characterWithArt("a", artDataUri()));

    // Reseal a well-formed cell whose kind tag ("z", the FIRST character) is neither "b" nor "t".
    const row = d.db.query("SELECT key, cell FROM blobs LIMIT 1").get() as { key: string; cell: string };
    const plaintext = cipher.open("blobs.cell", row.cell);
    const corrupted = `z${plaintext.slice(1)}`;
    d.db.query("UPDATE blobs SET cell = ? WHERE key = ?").run(cipher.seal("blobs.cell", corrupted), row.key);

    await expect(store.read("character", "a")).rejects.toBeInstanceOf(DamagedDataError);
  });
});

describe("SQLite blob store: no needless seals", () => {
  test("renaming a character whose art is unchanged seals zero blobs.cell", async () => {
    const inner = testCipher();
    let blobSeals = 0;
    const spying = { ...inner, seal: (where: string, text: string) => (where === "blobs.cell" ? (blobSeals++, inner.seal(where, text)) : inner.seal(where, text)) };
    const backend = sqliteDocumentBackend(onDisk(), spying);
    const store = createContentStore(backend, () => 1);
    await store.save(characterWithArt("vera", artDataUri()));
    blobSeals = 0; // only the rename itself is measured

    await store.save({ ...characterWithArt("vera", artDataUri()), body: { ...characterWithArt("vera", artDataUri()).body, identity: { name: "Renamed" } } }, { overwrite: true });

    expect(blobSeals).toBe(0); // the "h" part changed, but its one blob already existed
  });

  test("restoreVersion recreates blob_refs without sealing any blobs.cell", async () => {
    const inner = testCipher();
    let blobSeals = 0;
    const spying = { ...inner, seal: (where: string, text: string) => (where === "blobs.cell" ? (blobSeals++, inner.seal(where, text)) : inner.seal(where, text)) };
    const d = onDisk();
    const backend = sqliteDocumentBackend(d, spying);
    const store = createContentStore(backend, () => 1);
    await store.save(characterWithArt("r", artDataUri(1)));
    await store.save(characterWithArt("r", artDataUri(2)), { overwrite: true });
    blobSeals = 0; // only the restore itself is measured

    const restored = await store.restoreVersion("character", "r", 1);

    expect(restored).toMatchObject({ id: "r", version: 3 });
    expect(blobSeals).toBe(0); // the backend copied blob_refs in SQL, opening or sealing no blob cell
    const read = await store.read("character", "r");
    expect(portraitRef(read)).toBe(artDataUri(1));

    // The restored row's refs are real rows, not merely "it happened to read back right": every live
    // part's blob_refs points at a live piece_parts row.
    const dangling = d.db
      .query("SELECT count(*) AS n FROM blob_refs WHERE part_id NOT IN (SELECT id FROM piece_parts)")
      .get() as { n: number };
    expect(dangling.n).toBe(0);
  });
});

describe("SQLite blob store: VACUUM", () => {
  test("after VACUUM, every ref still points at its part and the orphan count is zero", async () => {
    const d = onDisk();
    const backend = sqliteDocumentBackend(d, testCipher());
    const store = createContentStore(backend, () => 1);

    // Create gaps in piece_parts' rowids before VACUUM, so a passing test proves something: a purged
    // piece's rows and blob, several pruned versions of another, both physically removed.
    await store.save(characterWithArt("gone", artDataUri(9)));
    await store.delete("character", "gone");
    await store.purge(Number.MAX_SAFE_INTEGER);

    await store.save(characterWithArt("kept", artDataUri(5)));
    for (let n = 0; n < 10; n++) {
      await store.save({ ...characterWithArt("kept", artDataUri(5)), body: { ...characterWithArt("kept", artDataUri(5)).body, identity: { name: `v${n}` } } }, { overwrite: true });
    }
    await backend.pruneVersions("character", "kept", 1);

    await d.rebuild(); // VACUUM

    const read = await store.read("character", "kept");
    expect(portraitRef(read)).toBe(artDataUri(5));
    expect((await backend.counts()).orphanBlobs).toBe(0);
    const dangling = d.db
      .query("SELECT count(*) AS n FROM blob_refs WHERE part_id NOT IN (SELECT id FROM piece_parts)")
      .get() as { n: number };
    expect(dangling.n).toBe(0);
  });
});

describe("SQLite blob store: non-ASCII text payloads", () => {
  test("a non-ASCII escrow text blob round-trips exactly through real SQLite", async () => {
    // blob-sql.ts's `shaOf` (node:crypto over UTF-8 bytes) must agree with `hashHex` (Bun.CryptoHasher
    // on a string, used when `piece-parts-blob.ts` first mints the sentinel's key) bit-for-bit, or a
    // text blob would throw DamagedDataError the moment it is opened back from a real database -
    // ASCII text happens to make UTF-8 and a naive byte read agree, so only a multi-byte string proves
    // this through the real backend rather than through the two hash functions in isolation.
    const backend = sqliteDocumentBackend(onDisk(), testCipher());
    const store = createContentStore(backend);
    // Over BOTH thresholds: the string itself over BLOB_THRESHOLD (16,384 UTF-16 units), and the
    // escrow `raw` JSON wrapping it over RAW_PART_THRESHOLD, so `raw` becomes its own `r/<fmt>` part
    // (only an escrow PART's own encode call passes `allowTextFallback: true` - the head's own call
    // never does, so a string under either threshold would just stay inline, proving nothing).
    const nonAscii = "café 日本語 ação ".repeat(1_200);
    const saved = await store.save({
      ...character("accented"),
      original: { sillytavern: { raw: { blob: nonAscii }, unmapped: {} } },
    });

    expect((await backend.counts()).blobs).toBe(1);
    const read = await store.read("character", saved.id);
    expect((read?.entity.original as Record<string, { raw: { blob: string } }>)["sillytavern"]?.raw.blob).toBe(nonAscii);
  });
});

describe("SQLite part/blob framing: the remaining byte-length prefix (piece-parts-sql.ts)", () => {
  test("a multi-byte unicode part name round-trips exactly", async () => {
    const backend = sqliteDocumentBackend(onDisk(), testCipher());
    const store = createContentStore(backend);
    const blockId = "véra-日本語-ação"; // multi-byte UTF-8 (2- and 3-byte characters) in a part name
    const preset = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: "p",
      body: { name: "P", prompts: [prompt(blockId)] },
    };
    await store.save(preset);
    const read = await store.read("preset", "p");
    expect((read?.entity.body as { prompts: PresetPrompt[] }).prompts[0]!.id).toBe(blockId);
  });

  test("a piece_parts cell whose declared name length exceeds what remains throws DamagedDataError", async () => {
    const d = onDisk();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend);
    await store.save(character("vera"));

    // Corrupt the OPENED PLAINTEXT's own name-length prefix, then reseal: a truncated ciphertext would
    // fail AES-GCM's tag check before `decodeCell`'s own length check ever ran. Mutation-checked
    // (2026-09-30): with that explicit check removed, this still throws DamagedDataError - an
    // inflated length makes `subarray` fold the real trailing text into "name" too, so the identity
    // check right below it (recomputing the part's keyed hash) catches the same corruption anyway.
    // The explicit check is kept for its clearer message and because not every malformed shape
    // reduces to a bad identity; this test proves the fail-closed OUTCOME, not which line fires.
    const row = d.db.query("SELECT cell FROM piece_parts WHERE to_version IS NULL LIMIT 1").get() as { cell: string };
    const plaintext = cipher.open("piece_parts.cell", row.cell);
    const docKey = plaintext.slice(0, 64);
    const rest = plaintext.slice(64);
    const colon = rest.indexOf(":");
    const inflated = `${docKey}999999:${rest.slice(colon + 1)}`; // declares far more name bytes than remain
    d.db.query("UPDATE piece_parts SET cell = ? WHERE to_version IS NULL").run(cipher.seal("piece_parts.cell", inflated));

    await expect(store.read("character", "vera")).rejects.toBeInstanceOf(DamagedDataError);
  });
});
