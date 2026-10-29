/** Local host routes for inspecting and applying sealed theme appearance packages. */
import type { StateStore } from "../stage/contracts/state-store";
import type { SettingsStoreLike } from "../studio/contracts";
import { DEFAULT_STUDIO_THEME } from "../studio/settings-shape";
import type { PackagedAssets } from "./assets";
import { themeAssetResponse, type ThemePackageInput } from "../extensions/theme-contract";
import { createThemeLifecycle } from "../extensions/theme-lifecycle";
import { exampleThemeInventory, themeInventory } from "../extensions/theme-inventory";
import { toErrorMessage } from "../error-message";
import { err, json, readJsonObject } from "./server-security";

type Lifecycle = Awaited<ReturnType<typeof createThemeLifecycle>>;
export type ThemeReadService = Pick<Lifecycle, "effective" | "asset" | "revisionStamp">;
const bodyLimit = 512 * 1024;
const lifecycles = new WeakMap<StateStore, Promise<Lifecycle>>();

export function createThemeService(state: StateStore, packaged?: PackagedAssets): Promise<Lifecycle> {
  const current = lifecycles.get(state);
  if (current) return current;
  let pending: Promise<Lifecycle>;
  pending = Promise.all([themeInventory(packaged), exampleThemeInventory(packaged)])
    .then(([builtins, examples]) => createThemeLifecycle(state, builtins, examples, { safeMode: process.env.BUNZAI_SAFE_THEMES === "1" }))
    .catch((error) => { if (lifecycles.get(state) === pending) lifecycles.delete(state); throw error; });
  lifecycles.set(state, pending);
  return pending;
}

/** Keeps one writer per opened state document; remote callers receive only the read methods. */
export function createThemeRouteOwner(packaged: PackagedAssets | undefined, settings: SettingsStoreLike) {
  let owner: StateStore | null = null;
  let service: Promise<Lifecycle> | null = null;
  return async (req: Request, url: URL, state?: StateStore, reader?: ThemeReadService): Promise<Response> => {
    try {
      if (reader) return await handleThemeReadRoutes(req, url, reader, settings) ?? err("not found", 404);
      if (!state) return err("theme lifecycle is unavailable", 503);
      if (owner !== state || !service) {
        owner = state;
        let pending: Promise<Lifecycle>;
        pending = createThemeService(state, packaged).catch((error) => {
          if (service === pending) service = null;
          throw error;
        });
        service = pending;
      }
      return await handleThemeRoutes(req, url, await service, settings) ?? err("not found", 404);
    } catch (error) {
      console.error("theme lifecycle refused:", toErrorMessage(error, "unknown error"));
      return err("theme lifecycle could not complete this request", 500);
    }
  };
}

/** Returns null for unrelated paths; caller has already authenticated /api and enforced remote policy. */
export async function handleThemeRoutes(req: Request, url: URL, service: Lifecycle, settings: SettingsStoreLike): Promise<Response | null> {
  const p = url.pathname;
  const read = await handleThemeReadRoutes(req, url, service, settings);
  if (read) return read;
  if (p === "/api/themes/packages" && req.method === "GET") return json(await service.list());
  if (p === "/api/themes/examples" && req.method === "GET") return json(service.examples());
  const examplePackage = /^\/api\/themes\/examples\/([^/]+)\/package$/.exec(p);
  if (examplePackage && req.method === "GET") {
    try { return json(service.exportExample(decodeURIComponent(examplePackage[1]!))); }
    catch { return err("theme example not found", 404); }
  }
  if (!p.startsWith("/api/themes/")) return null;
  if (req.method !== "POST") return err("method not allowed", 405);
  const parsed = await readJsonObject(req, bodyLimit);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  try {
    if (p === "/api/themes/inspect") return json(await service.inspect(input as unknown as ThemePackageInput));
    if (p === "/api/themes/restore/inspect" && typeof input.id === "string") return json(await service.inspectRestore(input.id));
    const example = /^\/api\/themes\/examples\/([^/]+)\/inspect$/.exec(p);
    if (example) {
      let id: string;
      try { id = decodeURIComponent(example[1]!); } catch { return err("invalid theme example id", 400); }
      return json(await service.inspectExample(id));
    }
    if (p === "/api/themes/install") return json(await service.install(input.challenge, input.digest, input.decision));
    if (p === "/api/themes/deny") return json(await service.deny(input.challenge, input.digest));
    if (p === "/api/themes/broken" && typeof input.id === "string" && typeof input.digest === "string") { await service.markBroken(input.id, input.digest); return json({ ok: true }); }
    if (p === "/api/themes/healthy") { await service.confirmHealthy(); return json({ ok: true }); }
    const route = /^\/api\/themes\/(disable|enable|revoke|remove|restore)$/.exec(p);
    if (!route || typeof input.id !== "string") return err("unknown theme operation", 404);
    const id = input.id;
    if (route[1] === "disable") await service.disable(id);
    else if (route[1] === "enable") await service.enable(id);
    else if (route[1] === "revoke") await service.revoke(id);
    else if (route[1] === "remove") await service.remove(id);
    else await service.restore(id, input.challenge, input.digest, input.decision);
    return json({ ok: true });
  } catch (error) {
    return err(toErrorMessage(error, "theme operation refused"), 409);
  }
}

/** Effective appearance and active inert marks are the only theme reads exposed to approved guests. */
export async function handleThemeReadRoutes(req: Request, url: URL, service: ThemeReadService, settings: SettingsStoreLike): Promise<Response | null> {
  if (url.pathname === "/api/themes/effective" && req.method === "GET") {
    const stored = await settings.read();
    return json(await service.effective(stored.theme ?? DEFAULT_STUDIO_THEME));
  }
  if (url.pathname === "/api/themes/revision" && req.method === "GET") return json(service.revisionStamp());
  const asset = /^\/api\/themes\/assets\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (asset && req.method === "GET") {
    let id: string, assetId: string;
    try { id = decodeURIComponent(asset[1]!); assetId = decodeURIComponent(asset[2]!); } catch { return err("invalid theme asset path", 400); }
    const file = await service.asset(id, assetId, url.searchParams.get("digest") ?? "");
    return file === null ? err("theme asset is unavailable", 404) : themeAssetResponse(file);
  }
  return null;
}
