/** What an editor patch may put into an art or blob reference slot (one concept, split from content-store-patch.ts for the line cap). */
import { isCanonicalMediaReference } from "../../entities/_shared/media-reference";
import { isActiveMediaBlobReference, isEmbeddedMediaDataUri } from "../../entities/piece-parts-blob";
import { StudioValidationError } from "../../studio/errors";
import type { EntityKind } from "../contracts/content-store";

function storedAt(root: unknown, path: readonly (string | number)[]): unknown {
  let cursor = root;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, key)) return undefined;
    cursor = (cursor as Record<string | number, unknown>)[key];
  }
  return cursor;
}

/**
 * Every art or blob reference slot a patch head carries (the canonical media-slot classifier decides which
 * paths those are) must be empty, an asset sentinel (resolved against held or uploaded blobs by the decode
 * that follows), a well-formed embedded media data URI, or exactly what is already stored. An opaque upload
 * grant, a URL, a path or any other string is refused: the server could never resolve it to bytes.
 */
export function assertMediaRefsAuthorized(kind: EntityKind, value: unknown, stored: unknown, path: readonly (string | number)[] = []): void {
  if (typeof value === "string") {
    if (!isCanonicalMediaReference(kind, path)) return;
    if (value === "" || isActiveMediaBlobReference(value) || isEmbeddedMediaDataUri(value)) return;
    if (storedAt(stored, path) === value) return;
    throw new StudioValidationError(`patch ${path.join(".")} must be an uploaded asset, an embedded image, or unchanged`);
  }
  if (Array.isArray(value)) value.forEach((item, index) => assertMediaRefsAuthorized(kind, item, stored, [...path, index]));
  else if (value !== null && typeof value === "object") for (const [key, item] of Object.entries(value)) assertMediaRefsAuthorized(kind, item, stored, [...path, key]);
}
