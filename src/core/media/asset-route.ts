/** The browser-facing asset route, `/api/asset/<sha-256>`: the one reader of its path shape. */
import { isSha256Hex } from "../sha256";

/** Every hash-addressed asset path starts here; `/api/asset/upload` and `/api/asset/discard` share the prefix. */
export const ASSET_ROUTE_PREFIX = "/api/asset/";

/** The digest a path names (no query string), or null when the path is not `/api/asset/<64 lowercase hex>`. */
export function assetRouteSha(path: string): string | null {
  if (!path.startsWith(ASSET_ROUTE_PREFIX)) return null;
  const rest = path.slice(ASSET_ROUTE_PREFIX.length);
  return isSha256Hex(rest) ? rest : null;
}
