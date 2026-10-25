/** The SQLite DocumentBackend's yielding part reads: snapshot sealed cells synchronously, then decrypt them outside SQL. */
import type { LivePartBounds, LivePartSnapshot, PartText } from "../../contracts/content-store";
import type { CellCipher } from "../../crypto/cell-cipher";
import { openLightBlobSnapshot, openPartAtSnapshot, openPartSnapshot, readLightHeadAt, readLightPartBoundedAt, readLightPartsAt, snapshotLightBlobsAt, snapshotLiveParts, snapshotPartAt, snapshotPartsAt } from "./piece-parts-sql";
import type { StageDatabase } from "./database";
import { coldReadCharge } from "../cold-read-budget";
import { documentAssetReads } from "./document-backend-assets";

export function documentPartReads(input: { database: StageDatabase; cipher: CellCipher; key(kind: string, id: string): string }) {
  const { database, cipher } = input;
  const readSnapshot = <T>(work: () => T): Promise<T> => database.patiently(() => database.transaction(work));
  const readParts = async (kind: string, docKey: string, at?: number): Promise<PartText[] | null> => {
    const snapshot = await readSnapshot(() => {
      if (at !== undefined) return snapshotPartsAt(database.statement, kind, docKey, at);
      if (!database.statement("SELECT 1 FROM documents WHERE kind = ? AND id = ?").get(kind, docKey)) return null;
      return snapshotLiveParts(database.statement, kind, docKey);
    });
    return snapshot ? openPartSnapshot(cipher, snapshot) : null;
  };
  return {
    ...documentAssetReads(database, cipher),
    async livePartBounds(kind: string, id: string): Promise<LivePartBounds | null> {
      const docKey = input.key(kind, id);
      return readSnapshot(() => {
        const row = database.statement("SELECT write_id FROM documents WHERE kind = ? AND id = ?").get(kind, docKey) as { write_id: number } | null;
        if (!row) return null;
        const parts = database.statement("SELECT count(*) AS n, coalesce(sum(octet_length(cell)), 0) AS bytes FROM piece_parts WHERE kind = ? AND doc = ? AND to_version IS NULL").get(kind, docKey) as { n: number; bytes: number };
        const refs = database.statement("SELECT count(*) AS n, coalesce(sum(octet_length(b.cell)), 0) AS bytes FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id JOIN blobs b ON b.key = r.blob WHERE p.kind = ? AND p.doc = ? AND p.to_version IS NULL").get(kind, docKey) as { n: number; bytes: number };
        return { writeId: row.write_id, parts: parts.n, refs: refs.n, bytes: parts.bytes + refs.bytes };
      });
    },
    async liveParts(kind: string, id: string): Promise<LivePartSnapshot | null> {
      const docKey = input.key(kind, id);
      const snapshot = await readSnapshot(() => {
        const row = database.statement("SELECT write_id FROM documents WHERE kind = ? AND id = ?").get(kind, docKey) as { write_id: number } | null;
        return row ? { writeId: row.write_id, parts: snapshotLiveParts(database.statement, kind, docKey) } : null;
      });
      return snapshot ? { writeId: snapshot.writeId, parts: await openPartSnapshot(cipher, snapshot.parts) } : null;
    },
    async livePartsBounded(kind: string, id: string, expectedWriteId: number, maxCharge: number, maxParts: number, maxRefs: number): Promise<LivePartSnapshot | { status: "missing" | "stale" | "too-large" }> {
      const docKey = input.key(kind, id);
      const captured = await readSnapshot<{ status: "missing" | "stale" | "too-large" } | { writeId: number; snapshot: ReturnType<typeof snapshotLiveParts> }>(() => {
        const row = database.statement("SELECT write_id FROM documents WHERE kind = ? AND id = ?").get(kind, docKey) as { write_id: number } | null;
        if (!row) return { status: "missing" as const };
        if (row.write_id !== expectedWriteId) return { status: "stale" as const };
        const parts = database.statement("SELECT count(*) AS n, coalesce(sum(octet_length(cell)), 0) AS bytes FROM piece_parts WHERE kind = ? AND doc = ? AND to_version IS NULL").get(kind, docKey) as { n: number; bytes: number };
        const refs = database.statement("SELECT count(*) AS n, coalesce(sum(octet_length(b.cell)), 0) AS bytes FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id JOIN blobs b ON b.key = r.blob WHERE p.kind = ? AND p.doc = ? AND p.to_version IS NULL").get(kind, docKey) as { n: number; bytes: number };
        if (parts.n > maxParts || refs.n > maxRefs || coldReadCharge(parts.bytes + refs.bytes, parts.n, refs.n) > maxCharge) return { status: "too-large" as const };
        return { writeId: row.write_id, snapshot: snapshotLiveParts(database.statement, kind, docKey) };
      });
      if ("status" in captured) return captured;
      return { writeId: captured.writeId, parts: await openPartSnapshot(cipher, captured.snapshot) };
    },
    async parts(kind: string, id: string, at?: number) { return readParts(kind, input.key(kind, id), at); },
    async lightHead(kind: string, id: string, at: number) { return readLightHeadAt(database.statement, cipher, kind, input.key(kind, id), at); },
    async lightParts(kind: string, id: string, at: number, excludeNames: readonly string[]) {
      return readLightPartsAt(database.statement, cipher, kind, input.key(kind, id), at, excludeNames);
    },
    async lightPartBounded(kind: string, id: string, name: string, at: number, maxBytes: number) {
      return readLightPartBoundedAt(database.statement, cipher, kind, input.key(kind, id), name, at, maxBytes);
    },
    async lightBlobs(kind: string, id: string, name: string, at: number, expectedHashes: readonly string[], selectedHashes: readonly string[]) {
      const snapshot = await readSnapshot(() => snapshotLightBlobsAt(database.statement, cipher, kind, input.key(kind, id), name, at, expectedHashes, selectedHashes));
      return openLightBlobSnapshot(cipher, snapshot);
    },
    async part(kind: string, id: string, name: string, at: number) {
      const snapshot = await readSnapshot(() => snapshotPartAt(database.statement, cipher, kind, input.key(kind, id), name, at));
      return openPartAtSnapshot(cipher, snapshot);
    },
  };
}
