/** Runtime-neutral validation of editor patch envelopes for desktop and temporary browser Studio. */
import { ASSET_ADOPT_COUNT } from "./asset-content";
import { ASSET_BATCH_COUNT } from "../../core/media/limits";
import type { PiecePatch, SaveIntent } from "../../stage/contracts/content-store";
import { isRecord } from "../../core/guards";
import { isSha256Hex } from "../../core/sha256";

export type StudioPatchRequest = { kind: string; id: string; expectedRevision: string; patch: PiecePatch; uploads: string[]; intent: SaveIntent };

export function parseStudioPatchRequest(value: unknown): { ok: true; value: StudioPatchRequest } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isRecord(value)) return fail("expected patch object");
  const raw = value;
  const allowed = new Set(["kind", "id", "expectedRevision", "intent", "head", "items", "order", "original", "native", "uploads"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) return fail("unexpected patch field");
  if (typeof raw.kind !== "string" || typeof raw.id !== "string" || !isSha256Hex(raw.expectedRevision)) return fail("expected kind, id, and a valid expectedRevision");
  if (!("head" in raw)) return fail("expected patch head");
  if (raw.intent !== undefined && raw.intent !== "manual" && raw.intent !== "autosave") return fail("invalid save intent");
  if (raw.items !== undefined && !isRecord(raw.items)) return fail("expected patch items to be an object");
  if (raw.order !== undefined && (!Array.isArray(raw.order) || raw.order.some((name) => typeof name !== "string"))) return fail("expected patch order to be strings");
  if (raw.original !== undefined && !isRecord(raw.original)) return fail("expected patch original to be an object");
  if (raw.native !== undefined && !isRecord(raw.native)) return fail("expected native patch operations to be an object");
  const native = raw.native as Record<string, unknown> | undefined;
  if (native && Object.keys(native).some((key) => key !== "marinaraFolderParents" && key !== "risuAdditionalAssets")) return fail("unexpected native patch operation");
  if (native?.marinaraFolderParents !== undefined && (!Array.isArray(native.marinaraFolderParents) || native.marinaraFolderParents.some((edge) =>
    !isRecord(edge) || typeof edge.id !== "string" ||
    !(edge.parentFolderId === null || typeof edge.parentFolderId === "string")))) return fail("invalid Marinara folder parents");
  if (native?.risuAdditionalAssets !== undefined && (!Array.isArray(native.risuAdditionalAssets) || native.risuAdditionalAssets.length > 1000 || native.risuAdditionalAssets.some((row) =>
    !Array.isArray(row) || row.length !== 3 || row.some((part) => typeof part !== "string")))) return fail("invalid Risu named assets");
  if (raw.uploads !== undefined && (!Array.isArray(raw.uploads) || raw.uploads.some((ref) => typeof ref !== "string"))) return fail("expected upload refs to be strings");
  const uploads = (raw.uploads as string[] | undefined) ?? [];
  if (uploads.length > ASSET_BATCH_COUNT + ASSET_ADOPT_COUNT) return fail("too many upload refs");
  if (new Set(uploads).size !== uploads.length) return fail("duplicate upload ref");
  return { ok: true, value: {
    kind: raw.kind, id: raw.id, expectedRevision: raw.expectedRevision, uploads, intent: raw.intent ?? "manual",
    patch: { head: raw.head,
      ...(raw.items === undefined ? {} : { items: raw.items as Record<string, unknown> }),
      ...(raw.order === undefined ? {} : { order: raw.order as string[] }),
      ...(raw.original === undefined ? {} : { original: raw.original as Record<string, unknown> }),
      ...(native === undefined ? {} : { native: native as NonNullable<PiecePatch["native"]> }),
    },
  } };
}
