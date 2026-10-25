/** Opaque blob reads and targeted portrait projections for ContentStore. */
import type { ContentStore, DocumentBackend, EntityKind } from "../contracts/content-store";
import { StudioValidationError } from "../../studio/errors";
import { readPortraitAsset, readPortraitContent } from "./content-store-light";
import { isSha256Hex } from "../../core/sha256";

const MAX_ASSET_READ_BYTES = Number.MAX_SAFE_INTEGER;
type LiveRow = Parameters<typeof readPortraitAsset>[1];
type Address = (kind: unknown, id: unknown) => { kind: EntityKind; id: string };

export function assetReaders(backend: DocumentBackend, liveRow: LiveRow, addr: Address): Pick<ContentStore, "readAsset" | "assetSize" | "readPortraitAsset" | "readPortraitContent"> {
  return {
    async readAsset(sha, maxBytes) {
      if (!isSha256Hex(sha) || !Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > MAX_ASSET_READ_BYTES) {
        throw new StudioValidationError("invalid bounded asset request");
      }
      return backend.asset(sha, maxBytes);
    },
    async assetSize(sha) {
      return isSha256Hex(sha) ? backend.assetSize(sha) : { status: "missing" };
    },
    async readPortraitAsset(kindRaw, idRaw) {
      const { kind, id } = addr(kindRaw, idRaw);
      return readPortraitAsset(backend, liveRow, kind, id);
    },
    async readPortraitContent(kindRaw, idRaw) {
      const { kind, id } = addr(kindRaw, idRaw);
      return readPortraitContent(backend, liveRow, kind, id);
    },
  };
}
