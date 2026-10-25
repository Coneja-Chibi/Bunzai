/** Bounded content-addressed asset access with scalar admission before sealed-cell capture. */
import type { AssetLookup, AssetSize } from "../../contracts/content-store-asset";
import type { CellCipher } from "../../crypto/cell-cipher";
import type { StageDatabase } from "./database";
import { openBlobs, type SealedBlobRow } from "./blob-sql";
import { DamagedDataError } from "../../damaged-data-error";

export function documentAssetReads(database: StageDatabase, cipher: CellCipher): {
  asset(sha: string, maxBytes: number): Promise<AssetLookup>;
  assetSize(sha: string): Promise<AssetSize>;
} {
  // The digest's shape is checked once, by the content store's interface; a key that is not held is simply missing.
  const valid = (maxBytes?: number) => maxBytes === undefined || Number.isSafeInteger(maxBytes) && maxBytes >= 0;
  const read = <T>(work: () => T): Promise<T> => database.patiently(() => database.transaction(work));
  return {
    async assetSize(sha) {
      const key = cipher.index(sha);
      const row = await read(() => database.statement("SELECT bytes FROM blobs WHERE key = ?").get(key) as { bytes: number } | null);
      if (row && (!Number.isSafeInteger(row.bytes) || row.bytes < 0)) throw new DamagedDataError("blobs.bytes", "the blob has an invalid byte count");
      return row ? { status: "ok", bytes: row.bytes } : { status: "missing" };
    },
    async asset(sha, maxBytes) {
      if (!valid(maxBytes)) return { status: "missing" };
      const key = cipher.index(sha);
      const maxCell = Math.min(Number.MAX_SAFE_INTEGER, maxBytes * 2 + 4096);
      const row = await read(() => {
        const meta = database.statement("SELECT bytes, octet_length(cell) AS cell_bytes FROM blobs WHERE key = ?").get(key) as { bytes: number; cell_bytes: number } | null;
        if (!meta) return { status: "missing" as const };
        if (!Number.isSafeInteger(meta.bytes) || meta.bytes < 0 || !Number.isSafeInteger(meta.cell_bytes) || meta.cell_bytes < 0) throw new DamagedDataError("blobs.bytes", "the blob has an invalid byte count");
        if (meta.bytes > maxBytes || meta.cell_bytes > maxCell) return { status: "too-large" as const };
        const cell = database.statement("SELECT cell FROM blobs WHERE key = ?").get(key) as { cell: string } | null;
        return cell ? { status: "ok" as const, row: { key, cell: cell.cell } satisfies SealedBlobRow, expectedBytes: meta.bytes } : { status: "missing" as const };
      });
      if (row.status !== "ok") return row;
      const payload = (await openBlobs(cipher, [row.row])).get(key)?.payload;
      if (!payload) throw new DamagedDataError("blobs.cell", "the asset row disappeared while opening");
      const bytes = payload.kind === "bytes" ? payload.bytes : Buffer.from(payload.text, "utf8");
      if (bytes.byteLength !== row.expectedBytes) throw new DamagedDataError("blobs.bytes", "the blob byte count does not match its payload");
      return { status: "ok", bytes: new Uint8Array(bytes) };
    },
  };
}
