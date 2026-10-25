/**
 * Pack editor document projection. Retains named groups and source escrow even though the current
 * visible editor only mutates the default pack.
 */
import { normalizePack } from "../../../core/media";
import type { PackBody } from "../../../entities/pack/schema";
import { recOr } from "../../../core/guards";

export interface PackEditorDocument {
  body: PackBody;
  original: Record<string, unknown>;
}

export function packEditorDocument(entity: unknown): PackEditorDocument {
  const source = recOr(entity);
  const rawBody = recOr(source.body);
  const name = typeof rawBody.name === "string" && rawBody.name.trim()
    ? rawBody.name.trim()
    : "Untitled pack";
  const brief = typeof rawBody.brief === "string" ? rawBody.brief : "";
  const rawGroups = recOr(rawBody.groups);
  const groups = Object.fromEntries(
    Object.entries(rawGroups).map(([id, pack]) => [id, normalizePack(pack)]),
  );
  return {
    body: {
      name,
      ...(brief ? { brief } : {}),
      pack: normalizePack(rawBody.pack),
      ...(Object.keys(groups).length ? { groups } : {}),
    },
    original: structuredClone(recOr(source.original)),
  };
}
