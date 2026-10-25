/**
 * The leaving-gate's enforcement boundary: open a link in the OS browser. POST-only (so embedded content cannot
 * GET-trigger it) and re-validated here - the client gate is UX, this is the gate. Only http/https survive
 * safeExternalUrl; the NORMALIZED href is what we spawn, never the raw body. Split out of server.ts (pure code motion).
 */
import { safeExternalUrl } from "./_shared/external-url";
import { err, openInBrowser, readJsonObject } from "./server-security";

export async function handleOpenRoute(p: string, req: Request): Promise<Response | null> {
  if (p !== "/api/open" || req.method !== "POST") return null;
  const parsed = await readJsonObject(req, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const raw = typeof parsed.value.url === "string" ? parsed.value.url : "";
  const href = safeExternalUrl(raw);
  if (href === null) return err("refused: only http and https links open externally", 400);
  openInBrowser(href);
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
