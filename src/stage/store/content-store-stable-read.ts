/** Stable live-row decoding and the summary rebuild callback, shared by ContentStore read owners. */
import type { DocumentBackend, DocumentRow } from "../contracts/content-store";
import { decodeLive } from "./content-store-write";
import { buildSummary } from "./summary-content";

export async function decodeStableLive(backend: DocumentBackend, initial: DocumentRow): Promise<{ row: DocumentRow; decoded: NonNullable<Awaited<ReturnType<typeof decodeLive>>> } | null> {
  let row = initial;
  for (let attempt = 0; attempt < 3; attempt++) {
    const decoded = await decodeLive(backend, row);
    const latest = await backend.get(row.kind, row.id);
    if (!latest) return null;
    if (latest.writeId === row.writeId) return decoded ? { row, decoded } : null;
    row = latest;
  }
  return null;
}

export function computeSummaryFor(
  backend: DocumentBackend,
): (kind: string, id: string) => Promise<{ writeId: number; summary: ReturnType<typeof buildSummary> } | null> {
  return async (kind, id) => {
    const row = await backend.get(kind, id);
    if (!row) return null;
    const stable = await decodeStableLive(backend, row);
    return stable?.decoded.ok ? { writeId: stable.row.writeId, summary: buildSummary(stable.decoded.entity) } : null;
  };
}
