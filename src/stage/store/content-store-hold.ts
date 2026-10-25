/**
 * The patch path's cache fill for a backend with no cold-read worker (the memory backend, `:memory:`):
 * the same "keep pictures as references" fill the SQLite worker does, built from the backend's light
 * reads. Part text comes back without any blob; only the blobs a part's NON-picture sentinels need
 * (escrow text) are opened. Every picture a media slot names stays a sentinel in the cached value and a
 * plain hash in `refs`, so a pack of any picture weight is cached as a few kilobytes of references.
 */
import { holdingBlobNeeds } from "../../entities/piece-parts";
import type { PartRecord } from "../../entities/piece-parts";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { DocumentBackend, DocumentRow, EntityKind, PartText } from "../contracts/content-store";
import { coldFillParts } from "./content-store-write";

type HoldFill = { writeId: number; filled: { entity: ParsedCanonicalEntity; parts: PartRecord[] }; valid(): boolean; release(): void } | { status: "missing" | "stale" };

/** `at`: an earlier version of the piece (history), instead of the live one. */
export async function holdFill(backend: DocumentBackend, kind: EntityKind, row: DocumentRow, charge: number, at = row.version): Promise<HoldFill> {
  const texts = await backend.lightParts(kind, row.id, at, []);
  if (!texts || texts.length === 0) return { status: (await backend.get(kind, row.id)) ? "stale" : "missing" };
  const needs = holdingBlobNeeds(kind as ParsedCanonicalEntity["kind"], texts);
  const parts: PartText[] = [];
  for (const text of texts) {
    const need = needs.get(text.name)!;
    // Always asked, even with nothing to open: the backend checks the part's links against `expected`.
    const blobs = await backend.lightBlobs(kind, row.id, text.name, at, need.expected, need.selected);
    parts.push({ name: text.name, text: text.text, blobs });
  }
  const current = await backend.get(kind, row.id);
  if (!current) return { status: "missing" };
  if (current.writeId !== row.writeId) return { status: "stale" };
  const filled = await coldFillParts(parts, { charge, parts: 1000, refs: 1000 }, { kind, id: row.id }, true);
  // No worker, so no reservation to hold or release: the fill is already in this process.
  return filled ? { writeId: row.writeId, filled, valid: () => true, release: () => {} } : { status: "missing" };
}
