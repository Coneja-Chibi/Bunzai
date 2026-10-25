/** Route the appearance package lifecycle through the Pocket tab's sealed memory state. */
import { isRecord } from "../core/guards";
import { toErrorMessage } from "../error-message";
import { createThemeLifecycle } from "../extensions/theme-lifecycle";
import { themeAssetResponse, type ThemePackageInput } from "../extensions/theme-contract";
import type { SettingsStore } from "../studio/settings";
import { DEFAULT_STUDIO_THEME } from "../studio/settings-shape";

type Lifecycle = Awaited<ReturnType<typeof createThemeLifecycle>>;
interface Replies {
  json(value: unknown, status?: number): Response;
  error(message: string, status?: number): Response;
  contentTypeIs(request: Request, expected: string): boolean;
  readJson(request: Request, maxBytes?: number): Promise<unknown>;
}

export async function handlePocketThemeRoute(
  request: Request, url: URL, pending: Promise<Lifecycle>, settings: SettingsStore, reply: Replies,
): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith("/api/themes/")) return null;
  const service = await pending;
  if (path === "/api/themes/effective" && request.method === "GET") {
    const stored = await settings.read();
    return reply.json(await service.effective(stored.theme ?? DEFAULT_STUDIO_THEME));
  }
  const asset = /^\/api\/themes\/assets\/([^/]+)\/([^/]+)$/.exec(path);
  if (asset && request.method === "GET") {
    let id: string, assetId: string;
    try { id = decodeURIComponent(asset[1]!); assetId = decodeURIComponent(asset[2]!); }
    catch { return reply.error("invalid theme asset path"); }
    const file = await service.asset(id, assetId, url.searchParams.get("digest") ?? "");
    return file === null ? reply.error("theme asset is unavailable", 404) : themeAssetResponse(file);
  }
  const examplePackage = /^\/api\/themes\/examples\/([^/]+)\/package$/.exec(path);
  if (examplePackage && request.method === "GET") {
    let id: string;
    try { id = decodeURIComponent(examplePackage[1]!); } catch { return reply.error("invalid theme example id"); }
    try { return reply.json(service.exportExample(id)); } catch { return reply.error("theme example not found", 404); }
  }
  if (path === "/api/themes/packages" && request.method === "GET") return reply.json(await service.list());
  if (path === "/api/themes/examples" && request.method === "GET") return reply.json(service.examples());
  if (request.method !== "POST") return reply.error("method not allowed", 405);
  if (!reply.contentTypeIs(request, "application/json")) return reply.error("unsupported media type", 415);
  const parsed = await reply.readJson(request, 512 * 1024);
  if (!isRecord(parsed)) return reply.error("expected an object");
  const input = parsed;
  try {
    if (path === "/api/themes/inspect") return reply.json(await service.inspect(input as unknown as ThemePackageInput));
    if (path === "/api/themes/restore/inspect" && typeof input.id === "string") return reply.json(await service.inspectRestore(input.id));
    const example = /^\/api\/themes\/examples\/([^/]+)\/inspect$/.exec(path);
    if (example) {
      let id: string;
      try { id = decodeURIComponent(example[1]!); } catch { return reply.error("invalid theme example id"); }
      return reply.json(await service.inspectExample(id));
    }
    if (path === "/api/themes/install") return reply.json(await service.install(input.challenge, input.digest, input.decision));
    if (path === "/api/themes/deny") return reply.json(await service.deny(input.challenge, input.digest));
    if (path === "/api/themes/broken" && typeof input.id === "string" && typeof input.digest === "string") { await service.markBroken(input.id, input.digest); return reply.json({ ok: true }); }
    if (path === "/api/themes/healthy") { await service.confirmHealthy(); return reply.json({ ok: true }); }
    const route = /^\/api\/themes\/(disable|enable|revoke|remove|restore)$/.exec(path);
    if (!route || typeof input.id !== "string") return reply.error("unknown theme operation", 404);
    if (route[1] === "disable") await service.disable(input.id);
    else if (route[1] === "enable") await service.enable(input.id);
    else if (route[1] === "revoke") await service.revoke(input.id);
    else if (route[1] === "remove") await service.remove(input.id);
    else await service.restore(input.id, input.challenge, input.digest, input.decision);
    return reply.json({ ok: true });
  } catch (reason) {
    return reply.error(toErrorMessage(reason, "theme operation refused"), 409);
  }
}
