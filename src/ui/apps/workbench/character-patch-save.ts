/** Conditional character patch assembly and receipt-aware native asset grants. */
import { buildPiecePatch } from "../../_shared/editor-patch";
import { deepEq } from "./editor-core";
import type { StagedAssetUpload } from "../../app-contract-editor";
import type { PiecePatch, SaveIntent } from "../../../stage/contracts/content-store";
import { parseCanonicalEntity } from "../../../entities/runtime-schema";
import { recOr } from "../../../core/guards";
import { parseUploadedRef } from "../../../entities/piece-parts-blob";

export type NamedAssetRow = readonly [string, string, string];
export const rowsOfNamed = (value: { items: readonly { name: string; ref: string; ext?: string }[] }): NamedAssetRow[] =>
  value.items.map((item) => [item.name.trim(), item.ref, item.ext || "raw"] as const);

const assetSha = (ref: string): string | null => parseUploadedRef(ref)?.sha ?? null;
function collectStrings(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === "string") output.add(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, output);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, output);
  return output;
}
function withoutNamedAssets(raw: unknown, previous: unknown): unknown {
  const nextRaw = structuredClone(recOr(raw));
  const oldRisu = recOr(recOr(recOr(recOr(previous).data).extensions).risuai);
  const nextData = structuredClone(recOr(nextRaw.data));
  const nextExtensions = structuredClone(recOr(nextData.extensions));
  const nextRisu = structuredClone(recOr(nextExtensions.risuai));
  if (Object.hasOwn(oldRisu, "additionalAssets")) nextRisu.additionalAssets = structuredClone(oldRisu.additionalAssets);
  else delete nextRisu.additionalAssets;
  if (Object.keys(nextRisu).length) nextExtensions.risuai = nextRisu;
  else delete nextExtensions.risuai;
  nextData.extensions = nextExtensions;
  nextRaw.data = nextData;
  return nextRaw;
}

export async function saveCharacterPatch(input: {
  entity: unknown; expectedRevision: string; intent: SaveIntent; initEntity: Record<string, unknown>;
  baselineBody: Record<string, unknown>; nativeBaseline: Record<string, unknown>;
  namedRows: readonly NamedAssetRow[] | null; acceptedRows: readonly NamedAssetRow[];
  uploads: readonly StagedAssetUpload[]; mediaUploads: readonly StagedAssetUpload[];
  recoverNamed?(refs: readonly string[]): Promise<StagedAssetUpload[]>;
  patch(kind: string, id: string, revision: string, patch: PiecePatch, uploads: string[], intent: SaveIntent): Promise<{ revision: string }>;
  onAccepted(revision: string, rows: NamedAssetRow[], remaining: StagedAssetUpload[]): void;
  onAcceptedMedia(revision: string, remaining: StagedAssetUpload[]): void;
  isCurrent?(): boolean;
  id: string;
}): Promise<{ revision: string }> {
  const next = parseCanonicalEntity(input.entity);
  const base = parseCanonicalEntity({ ...input.initEntity, body: input.baselineBody });
  if (next.kind !== "character" || next.id !== input.id || base.kind !== "character" || base.id !== input.id) {
    throw new Error("Character save received a mismatched canonical entity");
  }
  const patch = buildPiecePatch(base, next);
  const original = recOr(next.original);
  const changed: Record<string, unknown> = {};
  for (const [format, entry] of Object.entries(original)) {
    const prior = recOr(input.nativeBaseline[format]);
    const current = recOr(entry);
    if (!deepEq(prior, current) && Object.hasOwn(current, "raw")) {
      changed[format] = format === "risu" && input.namedRows ? withoutNamedAssets(current.raw, prior.raw) : current.raw;
    }
  }
  if (Object.keys(changed).length) patch.original = changed;

  const target = input.namedRows;
  const priorRefs = new Set(input.acceptedRows.map((row) => row[1]));
  const grantBySha = new Map(input.uploads.map((grant) => [grant.sha, grant] as const));
  const missing = [...new Set((target ?? []).filter((row) => !priorRefs.has(row[1]) && !grantBySha.has(assetSha(row[1]) ?? "")).map((row) => row[1]))];
  if (missing.length && input.recoverNamed) for (const grant of await input.recoverNamed(missing)) grantBySha.set(grant.sha, grant);
  const namedGrants = target ? target.flatMap((row) => {
    if (priorRefs.has(row[1])) return [];
    const sha = assetSha(row[1]);
    const grant = sha ? grantBySha.get(sha) : undefined;
    if (!grant) throw new Error("new named asset is missing its session upload grant");
    return [grant];
  }) : [];
  const targetRefs = new Set(target?.map((row) => row[1]) ?? []);
  const bodyRefs = collectStrings({ body: next.body, original: changed });
  const ordinary = input.mediaUploads.filter((grant) => bodyRefs.has(grant.asset) && !targetRefs.has(grant.asset));
  const sent = [...new Map([...ordinary, ...namedGrants].map((grant) => [grant.ref, grant])).values()];
  if (sent.length > 8) throw new Error("Save up to eight staged media files at a time.");
  if (target) patch.native = { risuAdditionalAssets: target };
  if (input.isCurrent && !input.isCurrent()) throw new DOMException("save generation expired", "AbortError");
  const saved = await input.patch("character", input.id, input.expectedRevision, patch, sent.map((grant) => grant.ref), input.intent);
  if (input.isCurrent && !input.isCurrent()) return saved;
  const sentNamed = new Set(namedGrants.map((grant) => grant.ref));
  const sentOrdinary = new Set(ordinary.map((grant) => grant.ref));
  if (target) input.onAccepted(saved.revision, [...target], input.uploads.filter((grant) => !sentNamed.has(grant.ref)));
  input.onAcceptedMedia(saved.revision, input.mediaUploads.filter((grant) => !sentOrdinary.has(grant.ref)));
  return saved;
}
