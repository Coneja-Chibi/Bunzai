/**
 * Serving a piece's art: the one response both portrait routes use (the library's and a scene's
 * frozen copy). The bytes are untrusted, so the headers forbid sniffing and execution and serve an
 * inline image only. `no-store`, never `no-cache`: the art is decrypted plaintext, and `no-cache`
 * still lets Chrome and WebView2 write it to the browser's disk cache after revalidation (spec
 * "Encryption at rest" - "no plaintext on disk").
 */
import { portraitBytes } from "../studio/portrait";
import { err } from "./server-security";

export function portraitResponse(entity: Parameters<typeof portraitBytes>[0] | null): Response {
  const art = entity ? portraitBytes(entity) : null;
  if (!art) return err("no portrait", 404);
  // cast: TS's BodyInit lib type predates Uint8Array<ArrayBufferLike>; Bun accepts it fine.
  return new Response(art.bytes as unknown as BodyInit, {
    headers: {
      "content-type": art.mime,
      "cache-control": "no-store",
      "content-disposition": "inline; filename=portrait",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
