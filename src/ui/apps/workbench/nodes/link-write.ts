/**
 * The Nodes view's one write: add or remove a stored reference on a piece. Reads the piece fresh,
 * refuses a piece with unsaved Desk edits, sends only the difference, and on a revision conflict
 * re-reads and says so instead of retrying.
 */
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { buildPiecePatch } from "../../../../entities/editor-patch";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { toErrorMessage } from "../../../_shared/error-message";
import { keyOf } from "../../../_shared/piece-key";
import { canLink, refsOf, withRef, type RefField } from "./links";

export type LinkResult = "saved" | "unchanged" | "busy" | "conflict" | "failed";

/** The piece as the Desk editor reads it (characters and personas whole, presets light). */
export async function readSource(ctx: AppContext, kind: string, id: string): Promise<{ entity: ParsedCanonicalEntity; revision: string }> {
  const address = `kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
  const loaded = kind === "preset" ? await ctx.api.getLightEditableEntity(address) : await ctx.api.getEditableEntity(address);
  const entity = parseCanonicalEntity(loaded.entity);
  if (entity.kind !== kind || entity.id !== id) throw new Error("The library returned a different piece");
  return { entity, revision: loaded.revision };
}

export const dirtyTitle = (name: string): string => `Save or discard ${name}'s edits first`;

export interface WriteLabels {
  /** status line after the write lands */
  saved: string;
  /** status line when the write is refused by a newer revision */
  conflict: string;
  /** "could not <failed> <piece> · why" */
  failed: string;
}

/**
 * The one guarded write every Nodes edit goes through: refuse a piece with unsaved Desk edits, read it
 * fresh, let `edit` return the next entity (null: nothing to change, nothing is sent), send only the
 * difference, and on a revision conflict say so instead of retrying.
 */
export async function writePiece(
  ctx: AppContext,
  piece: StudioEntitySummary,
  labels: WriteLabels,
  edit: (entity: ParsedCanonicalEntity) => ParsedCanonicalEntity | null,
): Promise<LinkResult> {
  if (ctx.workbench.dirty()[keyOf(piece.id, piece.kind)]) {
    ctx.setStatus(dirtyTitle(piece.name));
    return "busy";
  }
  try {
    const { entity, revision } = await readSource(ctx, piece.kind, piece.id);
    const next = edit(entity);
    if (!next) return "unchanged";
    await ctx.api.patchEditedEntity(piece.kind, piece.id, revision, buildPiecePatch(entity, next));
    ctx.setStatus(labels.saved);
    return "saved";
  } catch (e) {
    if (e instanceof ApiHttpError && e.status === 409) {
      ctx.setStatus(labels.conflict);
      return "conflict";
    }
    ctx.setStatus(`could not ${labels.failed} ${piece.name} · ${toErrorMessage(e)}`);
    return "failed";
  }
}

export async function writeLink(
  ctx: AppContext,
  from: StudioEntitySummary,
  field: RefField,
  target: { id: string; kind: string },
  on: boolean,
): Promise<LinkResult> {
  if (!canLink(from.kind, field, target.kind)) return "failed";
  const verb = on ? "link" : "unlink";
  return writePiece(
    ctx,
    from,
    { saved: `${verb}ed ${from.name}`, conflict: `${from.name} changed somewhere else first, so nothing was ${verb}ed. The latest links are shown.`, failed: verb },
    (entity) => {
      if (refsOf(entity.body, field).includes(target.id) === on) return null;
      return { ...entity, body: withRef(entity.body, field, target.id, on) } as ParsedCanonicalEntity;
    },
  );
}
