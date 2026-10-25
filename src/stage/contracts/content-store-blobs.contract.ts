/**
 * The ContentStore blob contract: one sealed row per content hash, exact reference rows, deletion with the last
 * ref, across BOTH backends. Run by content-store.contract.ts and content-store.test.ts, the same way
 * content-store-concurrency.contract.ts is. SQLite-only proof (a swapped blob cell, VACUUM, the
 * multi-byte and malformed-cell framing tests) lives in content-store-blobs.sqlite.test.ts instead,
 * since the memory backend has no cells or VACUUM to prove anything about.
 */
import { describe, expect, test } from "bun:test";
import type { StoredEntity } from "./content-store";
import { artBytes, artDataUri, character, characterWithArt, personaWithArt, type Rig } from "./content-store.contract-fixtures";

/** `characterWithArt`/`personaWithArt` share one portrait slot (`entities/persona/schema.ts:125`); a
 * `StoredEntity.entity.body` is a union over every kind, so this one cast stands in for the kind
 * narrowing the fixtures already guarantee (every test here only ever reads back what it wrote). */
const portraitRef = (read: StoredEntity | null): string | undefined =>
  (read?.entity.body as { media?: { portrait?: { ref: string } } } | undefined)?.media?.portrait?.ref;

export function contentStoreBlobsContract(rig: () => Rig): void {
  describe("ContentStore blob contract (holistic 4.2; S4b)", () => {
    test("two cards with one image hold one blob", async () => {
      const { store, backend } = rig();
      const art = artDataUri();
      await store.save(characterWithArt("a", art));
      await store.save(characterWithArt("b", art));
      expect((await backend.counts()).blobs).toBe(1);
    });

    test("purging one keeps the blob, and purging both deletes it in the same transaction", async () => {
      const { store, backend } = rig();
      const art = artDataUri();
      await store.save(characterWithArt("a", art));
      await store.save(characterWithArt("b", art));

      await store.delete("character", "a");
      expect(await store.purge(Number.MAX_SAFE_INTEGER)).toBe(1);
      expect((await backend.counts()).blobs).toBe(1); // "b" still holds it
      expect((await backend.counts()).orphanBlobs).toBe(0);

      await store.delete("character", "b");
      expect(await store.purge(Number.MAX_SAFE_INTEGER)).toBe(1);
      expect((await backend.counts()).blobs).toBe(0);
      expect((await backend.counts()).orphanBlobs).toBe(0);
    });

    test("a blob shared across different kinds works (a persona and a character with the same image)", async () => {
      const { store, backend } = rig();
      const art = artDataUri();
      await store.save(characterWithArt("c", art));
      await store.save(personaWithArt("p", art));
      expect((await backend.counts()).blobs).toBe(1);

      await store.delete("character", "c");
      await store.purge(Number.MAX_SAFE_INTEGER);
      expect((await backend.counts()).blobs).toBe(1); // the persona still holds it

      await store.delete("persona", "p");
      await store.purge(Number.MAX_SAFE_INTEGER);
      expect((await backend.counts()).blobs).toBe(0);
      expect((await backend.counts()).orphanBlobs).toBe(0);
    });

    test("a PNG card's body art (a data URI) and its sourceMedia.b64 share one blob", async () => {
      const { store, backend } = rig();
      const bytes = artBytes();
      const art = artDataUri();
      const sourceMediaB64 = Buffer.from(bytes).toString("base64"); // bare base64 of the SAME bytes
      const saved = await store.save(characterWithArt("png-card", art, sourceMediaB64));
      expect((await backend.counts()).blobs).toBe(1); // body art and escrow twin: one blob, not two

      const read = await store.read("character", saved.id);
      expect(portraitRef(read)).toBe(art);
      expect((read?.entity.original as Record<string, { sourceMedia?: { b64: string } }>)["sillytavern"]?.sourceMedia?.b64).toBe(sourceMediaB64);
    });

    test("a non-canonical base64 payload round-trips exactly in text form", async () => {
      const { store, backend } = rig();
      // "QR==" decodes to one byte and re-encodes to "QQ==": same shape, different string, so it is
      // not shared (piece-parts-blob.ts rule), but it IS a blob once the escrow carrying it exceeds
      // the threshold - correct, just stored as text rather than bytes.
      const nonCanonical = "A".repeat(16_380) + "QR==";
      const before = (await backend.counts()).blobs;
      const saved = await store.save({
        ...character("odd-base64"),
        original: { sillytavern: { raw: { blob: nonCanonical }, unmapped: {} } },
      });
      expect((await backend.counts()).blobs).toBe(before + 1);

      const read = await store.read("character", saved.id);
      expect((read?.entity.original as Record<string, { raw: { blob: string } }>)["sillytavern"]?.raw.blob).toBe(nonCanonical);
    });

    test("long body text stays inline", async () => {
      const { store, backend } = rig();
      const before = (await backend.counts()).blobs;
      const longProse = "the quick brown fox jumps over the lazy dog. ".repeat(1000); // > 16 KB, not base64
      const saved = await store.save({ ...character("prose"), body: { ...character("prose").body, identity: { name: "prose", description: longProse } } });
      expect((await backend.counts()).blobs).toBe(before); // nothing extracted: prose, not media or escrow

      const read = await store.read("character", saved.id);
      expect((read?.entity.body as { identity: { description?: string } }).identity.description).toBe(longProse);
    });

    test("restoring a version recreates its refs", async () => {
      const { store, backend } = rig();
      const artA = artDataUri(1);
      const artB = artDataUri(2);
      await store.save(characterWithArt("r", artA));
      const afterB = await store.save(characterWithArt("r", artB), { overwrite: true });
      expect((await backend.counts()).blobs).toBe(2); // both still live: v1 has A, v2 has B

      const restored = await store.restoreVersion("character", "r", 1);
      expect(restored).not.toBeNull();
      await backend.pruneVersions("character", "r", 1); // keep only the live (restored) version

      const read = await store.read("character", "r");
      expect(portraitRef(read)).toBe(artA); // A survived the restore
      expect((await backend.counts()).blobs).toBe(1); // B is gone: no version can see it any more
      expect((await backend.counts()).orphanBlobs).toBe(0);
      void afterB;
    });

    test("prune and bury/unbury keep refs correct", async () => {
      const { store, backend } = rig();
      const art = artDataUri();
      await store.save(characterWithArt("stable", art));
      for (let n = 0; n < 5; n++) {
        // Same art every save: an edit that leaves the art alone must never re-seal or re-ref it.
        await store.save({ ...characterWithArt("stable", art), body: { ...characterWithArt("stable", art).body, identity: { name: `v${n}` } } }, { overwrite: true });
      }
      await backend.pruneVersions("character", "stable", 1);
      expect((await backend.counts()).blobs).toBe(1);
      expect((await backend.counts()).orphanBlobs).toBe(0);

      // Bury and unbury move no part rows (Appendix A section 4), so they must move no refs either.
      const beforeBury = await backend.counts();
      await store.delete("character", "stable");
      const [grave] = await store.graveyard();
      await store.restore(grave!.graveId);
      expect(await backend.counts()).toEqual(beforeBury);
      const read = await store.read("character", "stable");
      expect(portraitRef(read)).toBe(art);
    });

    test("a line-wrapped (non-canonical) data URI in a portrait stays inline, not a blob (plan/S3 mismatch)", async () => {
      // Plan 4.2 says ANY non-canonical rule (a)/(b) payload falls to the shared text form; S3's own
      // code (`piece-parts-blob.ts`) only does that inside escrow (`allowTextFallback`). Outside
      // escrow - a card's own portrait, here - a non-canonical data URI simply stays inline: correct
      // and byte-exact, just never deduplicated. Documented as a plan/implementation mismatch for the
      // lead, not silently widened (that would change r2 revisions - S3/S4a review, 2026-09-30).
      const { store, backend } = rig();
      const nonCanonical = "A".repeat(16_380) + "QR=="; // "QR==" decodes then re-encodes to "QQ=="
      const art = `data:image/png;base64,${nonCanonical}`;
      const before = (await backend.counts()).blobs;
      const saved = await store.save(characterWithArt("line-wrapped", art));
      expect((await backend.counts()).blobs).toBe(before); // nothing extracted

      const read = await store.read("character", saved.id);
      expect(portraitRef(read)).toBe(art); // still round-trips exactly, just not shared
    });

    test("purging one grave while a buried piece shares the blob keeps the blob", async () => {
      const { store, backend, setNow } = rig();
      const art = artDataUri();
      setNow(1_000);
      await store.save(characterWithArt("x", art));
      await store.save(characterWithArt("y", art));
      setNow(2_000);
      await store.delete("character", "x"); // graved at 2,000
      setNow(3_000);
      await store.delete("character", "y"); // graved at 3,000

      expect(await store.purge(2_500)).toBe(1); // only x's grave is older than the cutoff
      expect((await backend.counts()).blobs).toBe(1); // y's still-buried grave holds the blob
      expect((await backend.counts()).orphanBlobs).toBe(0);

      expect(await store.purge(3_500)).toBe(1); // now y's grave too
      expect((await backend.counts()).blobs).toBe(0);
      expect((await backend.counts()).orphanBlobs).toBe(0);
    });

    test("the parts() reader returns blobs so that assemble() still works unchanged", async () => {
      const { store } = rig();
      const art = artDataUri();
      await store.save(characterWithArt("roundtrip", art));
      const read = await store.read("character", "roundtrip");
      expect(portraitRef(read)).toBe(art);
    });
  });
}
