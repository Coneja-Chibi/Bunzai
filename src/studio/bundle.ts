/**
 * Studio bundle save orchestration: persist the pieces extracted with a primary first (a card's lorebook, a preset's
 * regex sets), rename the primary's links to any keep-both ids they got (core/links.ts), then save the primary.
 * Partial failure is reported explicitly; already-written related pieces are retained (data-preserving orphans). No
 * format logic - adapters live in convert.ts.
 */
import { toErrorMessage } from "../error-message";
import type { CanonicalEntity } from "../core/canonical";
import {
  safeParseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "../entities/runtime-schema";
import { portsOf, withLinksRenamed } from "../core/links";
import { kindOf } from "../generated/kinds";
import type { EntitySummary } from "./store";
import type { StudioStoreLike } from "./contracts";
import { isLibraryLocked, StudioValidationError } from "./errors";
import type { ImportedSceneSummary } from "./scene-import";

type AnyEntity = CanonicalEntity<string, unknown>;

export interface BundleSaveInput {
  entity: AnyEntity;
  /** The pieces extracted with the primary, any kind (convert.ts readPieces); saved before it. */
  related?: unknown[];
  /** When true, primary and related overwrite by id (editor path). Import uses keep-both. */
  overwrite?: boolean;
}

export interface BundleSaveResult {
  ok: boolean;
  primary?: EntitySummary;
  related: EntitySummary[];
  /** Set when the primary was an imported chat: the scene it became (src/studio/scene-import.ts). */
  scene?: ImportedSceneSummary;
  /** Set when a refused chat is already a scene: the scene that holds it. A repeat import is a duplicate, not a failure. */
  alreadyImported?: { sceneId: string; title: string };
  /** True when some related writes succeeded and a later write failed. */
  partial?: boolean;
  error?: string;
}


function requireEntity(raw: unknown, label: string): ParsedCanonicalEntity {
  const parsed = safeParseCanonicalEntity(raw);
  if (!parsed.ok) {
    throw new StudioValidationError(`bundle: invalid ${label}: ${parsed.issues[0] ?? "unknown error"}`);
  }
  return parsed.entity;
}

/**
 * Reject an invalid batch before its first write; returns the parsed related pieces. A related piece must be of a kind
 * the primary links (core/links.ts), so a bundle can only carry what the primary can point at.
 */
export function preflightBundle(input: BundleSaveInput): ParsedCanonicalEntity[] {
  const primary = requireEntity(input.entity, "primary entity");
  if (input.related !== undefined && !Array.isArray(input.related)) throw new StudioValidationError("bundle: related must be a list of pieces");
  const linkable = new Set(portsOf(primary.kind).map((p) => p.to));
  return (input.related ?? []).map((raw) => {
    const piece = requireEntity(raw, "related piece");
    if (!linkable.has(piece.kind)) throw new StudioValidationError(`bundle: a ${primary.kind} does not link ${piece.kind} pieces`);
    return piece;
  });
}

/**
 * Persist a primary plus the pieces extracted with it. Related pieces first; keep-both renames rewrite the primary's
 * links to them before the primary is written.
 */
export async function saveBundle(
  store: StudioStoreLike,
  input: BundleSaveInput,
): Promise<BundleSaveResult> {
  const pieces = preflightBundle(input);
  const overwrite = input.overwrite === true;
  const related: EntitySummary[] = [];
  const renamed = new Map<string, string>();

  for (const piece of pieces) {
    try {
      const summary = await store.save(piece as AnyEntity, { overwrite });
      related.push(summary);
      if (summary.id !== piece.id) renamed.set(`${piece.kind}:${piece.id}`, summary.id);
    } catch (e) {
      if (isLibraryLocked(e) && related.length === 0) throw e; // nothing saved: the server answers 423
      const message = toErrorMessage(e);
      return {
        ok: false,
        partial: related.length > 0,
        related,
        error: `bundle: failed saving ${kindOf(piece.kind)?.receiptWord ?? piece.kind} "${piece.id}": ${message}`,
      };
    }
  }

  const entity = { ...input.entity, body: withLinksRenamed(input.entity.kind, input.entity.body, renamed) };

  try {
    const primary = await store.save(entity, { overwrite });
    return { ok: true, primary, related };
  } catch (e) {
    if (isLibraryLocked(e) && related.length === 0) throw e; // nothing saved: the server answers 423
    const message = toErrorMessage(e);
    return {
      ok: false,
      partial: related.length > 0,
      related,
      error: `bundle: failed saving primary "${entity.id}": ${message}`,
    };
  }
}
