/**
 * Runtime-neutral Studio read routes, shared by authenticated desktop routing and temporary browser Studio.
 */
import type { StudioStoreLike } from "../../studio/contracts";
import { compendiumChunks } from "../../formats/rolecall/compendium";
import { downloadResponse } from "./byte-stream";
import { openPackZip, PackExportError } from "./pack-export";

/** Return a Studio read response when the path is owned here, otherwise let the main router continue. */
export async function handleStudioRead(
  path: string,
  url: URL,
  store: StudioStoreLike,
  json: (value: unknown, status?: number) => Response,
  onError: (error: unknown) => Response,
): Promise<Response | null> {
  const kind = url.searchParams.get("kind") ?? undefined;
  try {
    if (path === "/api/studio/summary") {
      const id = url.searchParams.get("id") ?? "";
      return !kind || !id || !store.summary ? json(null) : json(await store.summary(kind, id));
    }
    if (path === "/api/studio/get") {
      const id = url.searchParams.get("id") ?? "";
      if (url.searchParams.get("light") === "1") {
        if (!store.readLight) return json({ error: "light reads are unavailable" }, 501);
        const light = await store.readLight(kind ?? "", id);
        return light ? json(light) : json({ error: "not found" }, 404);
      }
      if (url.searchParams.get("revision") === "1") {
        const stored = await store.readVersioned(kind ?? "", id);
        return stored ? json({ entity: stored.entity, revision: stored.revision }) : json({ error: "not found" }, 404);
      }
      const entity = await store.read(kind ?? "", id);
      if (!entity) return json({ error: "not found" }, 404);
      return json(entity);
    }
    if (path === "/api/studio/export-pack") {
      // A stored pack printed as a ZIP of its pictures, each read from the library as its turn comes.
      const chunks = await openPackZip(store, url.searchParams.get("id") ?? "");
      return downloadResponse(chunks, { type: "application/zip" });
    }
    if (path === "/api/studio/export-compendium") {
      // A book as RoleCall's compendium file: a header, one chunk per entry, a footer.
      const book = await store.read("lorebook", url.searchParams.get("id") ?? "");
      return book?.kind === "lorebook" ? downloadResponse(compendiumChunks(book), { type: "application/json" }) : json({ error: "not found" }, 404);
    }
    if (path === "/api/studio/list") return json(await store.list(kind));
    if (path === "/api/studio/inventory") return json(await store.inventory(kind));
    if (path === "/api/studio/trash") return json(await store.graveyard());
    if (path === "/api/studio/risu-assets") {
      const id = url.searchParams.get("id") ?? "";
      if (!kind || !id) return json(null);
      return json(store.readRisuNamedAssets ? await store.readRisuNamedAssets(kind, id) : null);
    }
    if (path === "/api/studio/original") {
      const id = url.searchParams.get("id") ?? "";
      const format = url.searchParams.get("format") ?? "";
      if (!kind || !id || !format) return json(null);
      if (url.searchParams.get("revision") === "1") {
        return json(store.readOriginalEntryVersioned ? await store.readOriginalEntryVersioned(kind, id, format) : null);
      }
      if (!store.readOriginalEntry) return json(null);
      const entry = await store.readOriginalEntry(kind, id, format);
      return json(entry);
    }
  } catch (error) {
    if (error instanceof PackExportError) return json({ error: error.message }, error.status);
    return onError(error);
  }
  return null;
}
