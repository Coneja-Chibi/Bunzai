/**
 * Making a new piece: save a body, hand back the summary the shelf and the Workbench share. `createBlank` is every
 * "New <kind>" door (Library decks, the World wing's New Lorebook, the Compendium's book, the tour, shelf menus): the
 * blank body and its starting id come from the kind's own kind.ts, so no door keeps its own copy.
 */
import type { AppContext, StudioEntitySummary } from "../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { kindOf } from "../../generated/kinds";
import { pieceName, withPieceName } from "../../core/piece-name";

/** Save a freshly built body under `kind`/`id` (the store makes the id unique) and return its workbench summary. */
export async function createAndOpenPiece(
  ctx: AppContext,
  kind: string,
  id: string,
  body: unknown,
): Promise<StudioEntitySummary> {
  const saved = await ctx.api.saveEntity({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id, body });
  return { id: saved.id, kind, name: saved.name || pieceName(kind, body), accent: saved.accent };
}

/** Whether the Library offers a blank "New" piece of this kind. */
export const canCreateBlank = (kind: string): boolean => kindOf(kind)?.blank !== undefined && kindOf(kind)?.libraryNew !== false;

/** Save a blank piece of `kind`, named `name` when given (under `id` when given), and return its summary. */
export async function createBlank(ctx: AppContext, kind: string, name?: string, id?: string): Promise<StudioEntitySummary> {
  const k = kindOf(kind);
  if (!k?.blank || !k.blankId) throw new Error(`a ${k?.receiptWord ?? kind} cannot be made blank`);
  const body = k.blank();
  return createAndOpenPiece(ctx, kind, id ?? k.blankId, name === undefined ? body : withPieceName(kind, body, name));
}
