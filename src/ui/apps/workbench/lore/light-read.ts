/** Light lorebook reader that fetches only native folder and import-heal escrow used by this editor. */
import type { AppContext } from "../../../app-contract";
import { isRecord, recOr } from "../../../../core/guards";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../../../entities/runtime-schema";

export function canonicalLorebook(entity: unknown, id: string): Extract<ParsedCanonicalEntity, { kind: "lorebook" }> {
  const parsed = parseCanonicalEntity(entity);
  if (parsed.kind !== "lorebook" || parsed.id !== id) throw new Error("Lorebook reread returned a mismatched entity");
  return parsed;
}

export function bodyFromEntity(entity: unknown): LorebookBody {
  const e = recOr(entity);
  const body = isRecord(e.body) ? e.body as unknown as LorebookBody : null;
  if (body && typeof body.name === "string" && Array.isArray(body.entries)) return structuredClone(body);
  return {
    name: "Untitled lorebook", tags: [], globalCaseSensitive: false, globalMatchWholeWords: false,
    globalScanDepth: 4, globalRecursion: false, tokenBudget: 0, budgetMode: "token", entryBudget: 0, entries: [],
  };
}

export async function readLoreLight(ctx: AppContext, id: string) {
  type OriginalRead = { entry: unknown | null; revision: string; version: number };
  const api = ctx.api as AppContext["api"] & {
    getEditableOriginalEntryVersioned(kind: string, pieceId: string, format: string): Promise<OriginalRead | null>;
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const [loaded, marinara, studio] = await Promise.all([
      api.getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(id)}`),
      api.getEditableOriginalEntryVersioned("lorebook", id, "marinara-lorebook"),
      api.getEditableOriginalEntryVersioned("lorebook", id, "vaud-studio"),
    ]);
    if (!marinara || !studio) throw new Error("Lorebook disappeared during its selective read");
    if (loaded.revision !== marinara.revision || loaded.version !== marinara.version ||
        loaded.revision !== studio.revision || loaded.version !== studio.version) continue;
    if (!isRecord(loaded.entity)) throw new Error("Lorebook light read did not return an entity");
    const original: Record<string, unknown> = {};
    if (marinara.entry !== null) original["marinara-lorebook"] = marinara.entry;
    if (studio.entry !== null) original["vaud-studio"] = studio.entry;
    return { ...loaded, entity: { ...loaded.entity, original } };
  }
  throw new Error("Lorebook changed repeatedly during its selective read");
}
