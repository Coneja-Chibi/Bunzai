/**
 * What a shelf row says about a piece.
 *
 * A summary is not the piece: it is the handful of facts a list needs to draw a row and a person
 * needs to recognise their own work. Kept apart from the store so the rules for picking a display
 * name or an accent are read in one place rather than inline in a filesystem walk.
 */
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import { isRecord } from "../core/guards";
import { studioStampOf } from "./studio-stamp";

type AnyEntity = ParsedCanonicalEntity;

export const HEX6 = /^#[0-9a-f]{6}$/i;

/** The piece's own signature: the first gradient stop (what the Cast editor writes) before the solid one, RoleCall's dialogue-color rule (VVS-734). */
export function authoredSignature(entity: { body?: unknown }): string | undefined {
  const pres = (entity as {
    body?: { presentation?: { signatureColor?: unknown; gradientColors?: unknown } };
  }).body?.presentation;
  const solid = typeof pres?.signatureColor === "string" ? pres.signatureColor : undefined;
  const stops = pres?.gradientColors;
  const first = Array.isArray(stops) && typeof stops[0] === "string" ? stops[0] : undefined;
  return [first, solid].find((hex): hex is string => hex !== undefined && HEX6.test(hex));
}

/** The piece's own signature as a list: its gradient's stops (up to three), else its one solid; empty when it authored none. */
export function authoredColors(entity: { body?: unknown }): string[] {
  const stops = (entity as { body?: { presentation?: { gradientColors?: unknown } } }).body?.presentation?.gradientColors;
  const list = Array.isArray(stops) ? stops.filter((c): c is string => typeof c === "string" && HEX6.test(c)).slice(0, 3) : [];
  const solid = authoredSignature(entity);
  return list.length > 0 ? list : solid ? [solid] : [];
}

/** The accent the Studio stamped from a piece's portrait at import; absent when none was readable. */
export function artAccentOf(entity: unknown): string | undefined {
  const cached = studioStampOf(entity as AnyEntity | null)["accent"];
  return typeof cached === "string" && HEX6.test(cached) ? cached : undefined;
}

/**
 * THE colour of a character or persona, for the Library card, the Scenes list, the scene and the Cast wing alike: its
 * authored signature, else its art accent. `art` stands in for the stamp when the caller holds a draft body apart from the stored piece.
 */
export function pieceAccent(entity: AnyEntity | { body?: unknown }, art: string | undefined = artAccentOf(entity)): string | undefined {
  return authoredSignature(entity) ?? art;
}

export function sourceOf(entity: AnyEntity): { format?: string; variant?: string } {
  for (const [formatId, entry] of Object.entries(entity.original ?? {})) {
    if (formatId === "vaud-studio") continue;
    const variant = entry?.unmapped?.["variant"];
    return { format: formatId, variant: typeof variant === "string" ? variant : undefined };
  }
  return {};
}

/**
 * A piece's own content tags: a character's discovery tags, any other kind's body tags. Only
 * non-empty strings; absent or malformed tags are no tags, never an error (the summary is a
 * listing, and a listing does not refuse a piece over its tags).
 */
export function entityTags(entity: { kind: string; body?: unknown }): string[] {
  const body = isRecord(entity.body) ? entity.body : undefined;
  if (!body) return [];
  const discovery = isRecord(body.discovery) ? body.discovery : undefined;
  const raw = entity.kind === "character" ? discovery?.tags : body.tags;
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [];
}

/** The summary field for a piece's tags: `{ tags }`, or nothing at all when it has none. */
export function tagsField(entity: { kind: string; body?: unknown }): { tags?: string[] } {
  const tags = entityTags(entity);
  return tags.length > 0 ? { tags } : {};
}

/** The display name for a piece: identity.name, then body.name, then its id. One rule, so a piece is
 *  called the same thing on the shelf and everywhere that names one before it is stored. */
export function entityName(entity: AnyEntity): string {
  const body = isRecord(entity.body) ? entity.body : undefined;
  if (!body) return entity.id;
  const identity = body.identity as { name?: string } | undefined;
  if (typeof identity?.name === "string" && identity.name) return identity.name;
  if (typeof body.name === "string" && body.name) return body.name;
  return entity.id;
}
