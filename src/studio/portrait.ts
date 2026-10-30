/**
 * Portrait extraction - pure reader that finds the displayable portrait inside a canonical entity.
 * Order of truth: (1) any original entry's sourceMedia image carrier (a PNG card's own pixels),
 * (2) a data-URI portrait in body.media. Tolerant: anything malformed reads as "no portrait".
 */
import type { CanonicalEntity } from "../core/canonical";
import { base64ToBytes } from "../core/base64";
import { mediaBlobReference } from "../entities/piece-parts-blob";
import { isRecord } from "../core/guards";

type AnyEntity = CanonicalEntity<string, unknown>;
export interface PortraitCandidate { kind: string; id: string; original?: Record<string, unknown>; body: unknown }

export interface PortraitBytes {
  bytes: Uint8Array;
  mime: string;
}

const DATA_URI = /^data:([a-z0-9.+/-]+);base64,(.+)$/i;

/** Raster images only, fail closed: entity JSON is untrusted (imported cards), so the mime is an
 * ALLOWLIST, never trusted from the payload. SVG is excluded on purpose - it can carry scripts. */
const SAFE_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const isSafeImageMime = (mime: unknown): mime is string =>
  typeof mime === "string" && SAFE_IMAGE_MIMES.has(mime.toLowerCase());

const STRICT_B64 = /^[A-Za-z0-9+/]+={0,2}$/;
export type PortraitReference = { sha: string; mime: string } | { url: string; mime: string; bytes?: number };

function base64ByteLength(value: string): number | undefined {
  if (value.length % 4 !== 0 || !STRICT_B64.test(value)) return undefined;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return value.length / 4 * 3 - padding;
}

/** Selects portrait identity without decoding asset bytes, for the pinned hash-addressed read path. */
export function portraitReference(entity: PortraitCandidate): PortraitReference | null {
  const source = findPortraitReference(entity);
  return source;
}

function findPortraitReference(entity: PortraitCandidate): PortraitReference | null {
  const fromB64 = (value: unknown, mime: unknown): PortraitReference | null => {
    if (typeof value !== "string") return null;
    const blob = mediaBlobReference(value);
    if (blob) {
      const normalizedMime = isSafeImageMime(mime) ? mime.toLowerCase() : blob.mime?.toLowerCase();
      return isSafeImageMime(normalizedMime) ? { sha: blob.sha, mime: normalizedMime } : null;
    }
    const uri = DATA_URI.exec(value);
    const normalizedMime = uri?.[1]?.toLowerCase() ?? (isSafeImageMime(mime) ? mime.toLowerCase() : "");
    if (!isSafeImageMime(normalizedMime)) return null;
    const b64 = uri?.[2] ?? value;
    const bytes = base64ByteLength(b64);
    if (!bytes || bytes <= 0) return null;
    return { url: legacyPortraitUrl(entity), mime: normalizedMime, bytes };
  };
  for (const entry of Object.values(entity.original ?? {})) {
    const media = isRecord(entry) ? entry.sourceMedia : undefined;
    const reference = isRecord(media) ? fromB64(media.b64, media.mime) : null;
    if (reference) return reference;
  }
  const body = entity.body as { media?: { portrait?: { ref?: unknown; mime?: unknown } }; pack?: { items?: { ref?: unknown; mime?: unknown }[]; defaultLabel?: unknown } } | undefined;
  const ref = body?.media?.portrait?.ref;
  if (typeof ref === "string") {
    const blob = mediaBlobReference(ref);
    if (blob) {
      const mime = body?.media?.portrait?.mime ?? blob.mime;
      if (isSafeImageMime(mime)) return { sha: blob.sha, mime: mime.toLowerCase() };
    }
    const match = DATA_URI.exec(ref);
    if (match && isSafeImageMime(match[1])) {
      const bytes = base64ByteLength(match[2]!);
      if (bytes) return { url: legacyPortraitUrl(entity), mime: match[1]!.toLowerCase(), bytes };
    }
  }
  if (entity.kind === "pack" && body?.pack) {
    const items = Array.isArray(body.pack.items) ? body.pack.items : [];
    const label = typeof body.pack.defaultLabel === "string" ? body.pack.defaultLabel.toLowerCase() : "";
    const ordered = label ? [...items.filter((it) => typeof it?.ref === "string" && String((it as { label?: string }).label ?? "").toLowerCase() === label), ...items] : items;
    for (const item of ordered) {
      const reference = item && fromB64(item.ref, item.mime);
      if (reference) return reference;
    }
  }
  return null;
}

function legacyPortraitUrl(entity: PortraitCandidate): string {
  return `/api/studio/portrait?kind=${encodeURIComponent(entity.kind)}&id=${encodeURIComponent(entity.id)}`;
}

function fromB64(b64: string, mime: string): PortraitBytes | null {
  // The decoder rejects malformed base64; imported payloads do not get lenient repair here.
  if (!STRICT_B64.test(b64)) return null;
  try {
    const bytes = base64ToBytes(b64);
    return bytes.length > 0 ? { bytes, mime } : null;
  } catch {
    return null;
  }
}

/** True for inline portrait bytes, or a media reference backed by the caller's explicit blob ownership. */
export function hasPortrait(entity: AnyEntity, ownsBlob?: (sha: string) => boolean): boolean {
  if (findPortraitSource(entity) !== null) return true;
  const reference = ownsBlob ? portraitReference(entity) : null;
  return reference !== null && "sha" in reference && ownsBlob?.(reference.sha) === true;
}

/** Decode the portrait bytes, or null when the entity carries none. */
export function portraitBytes(entity: AnyEntity): PortraitBytes | null {
  return portraitBytesFromCandidate(entity);
}

/** Decodes a portrait from an already targeted head/body projection. */
export function portraitBytesFromCandidate(entity: PortraitCandidate): PortraitBytes | null {
  const src = findPortraitSource(entity as AnyEntity);
  return src ? fromB64(src.b64, src.mime) : null;
}

const decodable = (b64: string): boolean => (base64ByteLength(b64) ?? 0) > 0;

function findPortraitSource(entity: AnyEntity): { b64: string; mime: string } | null {
  for (const entry of Object.values(entity.original ?? {})) {
    const media = entry?.sourceMedia;
    if (media && typeof media.b64 === "string" && decodable(media.b64) && isSafeImageMime(media.mime)) {
      return media;
    }
  }
  const body = entity.body as {
    media?: { portrait?: { ref?: unknown; mime?: unknown } };
    pack?: { items?: { ref?: unknown }[]; defaultLabel?: unknown };
  } | undefined;
  const ref = body?.media?.portrait?.ref;
  if (typeof ref === "string") {
    const m = DATA_URI.exec(ref);
    if (m && isSafeImageMime(m[1]) && decodable(m[2]!)) return { mime: m[1]!.toLowerCase(), b64: m[2]! };
  }
  // library pack entity: first / default face as shelf cover
  if (entity.kind === "pack" && body?.pack) {
    const items = Array.isArray(body.pack.items) ? body.pack.items : [];
    const def =
      typeof body.pack.defaultLabel === "string" ? body.pack.defaultLabel.toLowerCase() : "";
    const ordered = def
      ? [
          ...items.filter(
            (it) => typeof it?.ref === "string" && String((it as { label?: string }).label ?? "").toLowerCase() === def,
          ),
          ...items,
        ]
      : items;
    for (const it of ordered) {
      if (typeof it?.ref !== "string") continue;
      const m = DATA_URI.exec(it.ref);
      if (m && isSafeImageMime(m[1]) && decodable(m[2]!)) return { mime: m[1]!.toLowerCase(), b64: m[2]! };
    }
  }
  return null;
}
