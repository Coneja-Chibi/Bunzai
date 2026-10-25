/** One whole-entity read with writeId retries and the optional SQLite cold-worker owner. */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { StudioConflictError } from "../../studio/atomic-file";
import { StudioReadError } from "../../studio/errors";
import { assertStudioEntityKind } from "../../studio/path-policy";
import type { DocumentBackend, DocumentRow, EntityKind } from "../contracts/content-store";
import type { PartRecord } from "../../entities/piece-parts";
import { coldFillParts, ColdReadDamageError } from "./content-store-write";

export type ColdFillResult =
  | { writeId: number; filled: { entity: ParsedCanonicalEntity; parts: PartRecord[] }; valid(): boolean; release(): void }
  | { status: "missing" | "stale" };

export async function readContentEntity(
  backend: DocumentBackend,
  liveRow: (kind: string, id: string) => Promise<DocumentRow | null>,
  kind: EntityKind,
  id: string,
  coldFill?: (kind: EntityKind, id: string, writeId: number, mode?: "hold") => Promise<ColdFillResult>,
): Promise<{ entity: ParsedCanonicalEntity; revision: string; version: number } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await liveRow(kind, id);
    if (!row) return null;
    if (coldFill) {
      const loaded = await coldFill(assertStudioEntityKind(row.kind), row.id, row.writeId);
      if ("status" in loaded) {
        const latest = await liveRow(kind, id);
        if (!latest) return null;
        if (latest.writeId !== row.writeId) continue;
        return null;
      }
      try {
        const latest = await liveRow(kind, id);
        if (!latest) return null;
        if (latest.writeId !== row.writeId || !loaded.valid()) continue;
        return { entity: loaded.filled.entity, revision: row.revision, version: row.version };
      } finally {
        loaded.release();
      }
    }
    const snapshot = await backend.livePartsBounded?.(kind, id, row.writeId, 8 * 1024 * 1024, 1000, 1000);
    if (!snapshot) throw new Error("the backend cannot safely bound a cold read");
    if ("status" in snapshot) {
      if (snapshot.status === "stale") continue;
      if (snapshot.status === "missing") return null;
      throw new Error("this piece exceeds the bounded cold-read memory limit");
    }
    if (!snapshot.parts.length) return null;
    let filled: Awaited<ReturnType<typeof coldFillParts>>;
    try { filled = await coldFillParts(snapshot.parts, { charge: 8 * 1024 * 1024, parts: 1000, refs: 1000 }, { kind: row.kind, id: row.id }); }
    catch (error) {
      if (error instanceof ColdReadDamageError) throw new StudioReadError(`${kind} ${id} is damaged`, error.reason);
      throw error;
    }
    const latest = await liveRow(kind, id);
    if (!latest) return null;
    if (latest.writeId !== row.writeId) continue;
    if (!filled) return null;
    return { entity: filled.entity, revision: row.revision, version: row.version };
  }
  throw new StudioConflictError(`${kind} ${id} changed repeatedly while opening`);
}
