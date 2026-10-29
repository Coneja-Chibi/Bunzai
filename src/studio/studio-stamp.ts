/**
 * The Studio's own stamp on a stored piece: when it first arrived (`importedAt`) and the accent read
 * from its portrait. It lives in the piece's `original["vaud-studio"]` escrow, the one bag Bunzai
 * owns, so no format's escrow is ever touched. It never records when a piece last changed: the
 * library keeps that, and a stamp that changed on every save would make every save a new version.
 */
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import { portraitBytes } from "./portrait";
import { signatureFromPng } from "./signature-color";

/** The Studio's escrow bag of a stored piece, or an empty one. */
export function studioStampOf(entity: ParsedCanonicalEntity | null | undefined): Record<string, unknown> {
  const um = entity?.original?.["vaud-studio"]?.unmapped;
  return um && typeof um === "object" ? { ...um } : {};
}

/** The accent the piece already carries, or one read from its PNG portrait. */
export function accentFor(entity: ParsedCanonicalEntity, prior: Record<string, unknown>): string | undefined {
  const priorAccent = prior["accent"];
  if (typeof priorAccent === "string") return priorAccent;
  const art = portraitBytes(entity);
  return art?.mime === "image/png" ? signatureFromPng(art.bytes) ?? undefined : undefined;
}

export interface Stamped {
  entity: ParsedCanonicalEntity;
  importedAt: string;
  accent: string | undefined;
}

/**
 * `entity` with the Studio's stamp: the prior bag kept, `importedAt` kept or set to `now`, the accent
 * kept or read.
 */
export function stampForStudio(entity: ParsedCanonicalEntity, prior: Record<string, unknown>, now: string): Stamped {
  const importedAt = typeof prior["importedAt"] === "string" ? (prior["importedAt"] as string) : now;
  const accent = accentFor(entity, prior);
  const stamped: ParsedCanonicalEntity = {
    ...entity,
    original: {
      ...(entity.original ?? {}),
      "vaud-studio": {
        raw: entity.original?.["vaud-studio"]?.raw ?? null,
        unmapped: {
          ...prior,
          importedAt,
          ...(accent ? { accent } : {}),
        },
      },
    },
  };
  return { entity: stamped, importedAt, accent };
}
