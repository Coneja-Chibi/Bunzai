/**
 * Deterministic revision for parsed canonical entities at optimistic-write boundaries.
 *
 * r2 (S3, the scale design;): a structural root over the entity's decomposed parts, not a hash of the
 * whole JSON text. `entityRevision` and the future parts store (S4a) both call `decompose`
 * (piece-parts.ts), so they can never disagree on a revision; a later patch save derives the same
 * value incrementally from cached part hashes instead of decomposing again. Still 64 lowercase hex,
 * so the server revision check (server-studio-write.ts) and every existing caller keep working.
 */
import { hashHex } from "../core/sha256";
import { decompose } from "./piece-parts";
import { safeParseCanonicalEntity, type ParsedCanonicalEntity } from "./runtime-schema";

const REVISION_ROOT_PREFIX = "bunraku-rev-2\n";

/**
 * Hash a structural root directly from `{ name, hash }` pairs, in decompose's canonical order.
 * Exported so a caller that already has a `decompose` result (the storage write path, S4a) derives
 * the same revision without decomposing the entity a second time. `entityRevision` below is this
 * function applied to a fresh `decompose(entity)`.
 */
export function revisionFromParts(parts: readonly { name: string; hash: string }[]): string {
  const lines = parts.map((p) => `${p.name}\t${p.hash}`);
  return hashHex(REVISION_ROOT_PREFIX + lines.join("\n"));
}

/** Hash the entity's structural root: sha256("bunraku-rev-2\n" + one "name\thash" line per part, in
 * decompose's canonical order). A part's hash already covers its blob sentinels (piece-parts-blob.ts),
 * so this stays a pure function of content even though large media and escrow strings live outside
 * the part's own json text. */
export function entityRevision(entity: ParsedCanonicalEntity): string {
  return revisionFromParts(decompose(entity));
}

/**
 * Whether saving `next` over `baseline` would change anything. Every writer asks this before it
 * saves: a save that changes nothing is not made. The library still refuses to version one, and
 * reports it when it happens (content-store.ts), because a caller reaching it skipped this check.
 * Both sides are parsed first: the revision hashes key order, and the same content handed over in
 * another order must not look like a change. Anything that does not parse counts as dirty.
 */
export function isDirty(baseline: unknown, next: unknown): boolean {
  const before = safeParseCanonicalEntity(baseline);
  const after = safeParseCanonicalEntity(next);
  if (!before.ok || !after.ok) return true;
  return entityRevision(before.entity) !== entityRevision(after.entity);
}
