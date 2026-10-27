/**
 * Pure part decomposition for the holistic storage engine. One module
 * owns splitting a canonical entity into named part rows and rebuilding it from them, so the store,
 * `entityRevision`, and any future patch builder can never disagree. No I/O, no storage shape: S4a
 * lands parts in SQLite, S4b lands the blob table. This module only decides names, boundaries, and
 * byte-exact reconstruction.
 *
 * Part names: "h" (head), "o" (order, split kinds only), "i/<id>" and "i/<id>#<n>" (items, n >= 2
 * for a repeated id), "r/<fmt>" (an escrow `original[fmt].raw` over the 16 KB threshold). There is
 * no "m/<fmt>": holistic 4.3 amends Appendix A here, since `sourceMedia.b64` is bare base64 and
 * extracts as a blob (rule b) like any other large media field, rather than becoming its own part.
 */
import type { Original, OriginalEntry } from "../core/canonical";
import { hashHex } from "../core/sha256";
import type { KindParts } from "./kind-parts";
import { decodeBlobs, decodeBlobsHolding, decodeLightTextBlobs, encodeBlobs, lightBlobRefs, mayNeedBlobWalk, sentinelBlobRefs, type KnownBlobs, type PartBlob } from "./piece-parts-blob";
import { KIND_PARTS as GENERATED_PARTS } from "../generated/kind-schemas";
import type { ParsedCanonicalEntity } from "./runtime-schema";

type Kind = ParsedCanonicalEntity["kind"];

/** Each kind's own parts.ts, collected statically by the generated kind seam (decompose is a synchronous hot path,
 * so it cannot scan folders). A kind without a parts.ts has no item parts. */
const partsOf = (kind: string): KindParts | undefined =>
  Object.hasOwn(GENERATED_PARTS, kind) ? (GENERATED_PARTS as Record<string, KindParts>)[kind] : undefined;

/** A value's JSON length of 16,384 UTF-16 code units or more moves `original[fmt].raw` into its own
 * "r/<fmt>" part instead of staying inline in the head (Appendix A section D; strict "exceeds", so
 * exactly 16,384 stays inline). Independent of `BLOB_THRESHOLD` in piece-parts-blob.ts, which decides
 * whether an individual STRING inside a part becomes a blob. */
const RAW_PART_THRESHOLD = 16 * 1024;

export interface PartRecord {
  name: string;
  json: string;
  hash: string;
  /** Blobs this part's own sentinels reference (holistic 4.2). Empty for a part with no large
   * media or escrow strings. */
  blobs: PartBlob[];
  /** Plain hashes of picture blobs this part points at without carrying their bytes (a write-side
   * cache holds a piece this way; see `decodePartHolding`). The backend links each to its existing blob
   * row and refuses the write when the row is missing. Absent when the part holds none. */
  refs?: string[];
  /** The exact JS value `json` was built from, kept by reference. Internal to the `reuse` path
   * below: compared only by identity, never read by `assemble`, `entityRevision`, or any storage
   * code. Not part of the wire contract S4a will seal. */
  value: unknown;
}

interface LightPartText {
  name: string;
  text: string;
}

const NAME_ESCAPES: Record<string, string> = { "%": "%25", "#": "%23", "\t": "%09", "\n": "%0A" };

/** Item ids and format ids are open, author-controlled strings (FormatId = string). "#" would
 * collide with the duplicate-occurrence suffix and a tab or newline would break the revision root's
 * one-name-per-line format, so all four are percent-encoded in a part name. Names are never decoded
 * back to an id: assemble looks parts up by the exact name string "o" already carries. Exported for
 * the patch path (S5), which has to find a cached escrow part by the same name `decompose` would give
 * it, without decomposing the whole entity to get there. */
export function encodeNamePart(raw: string): string {
  return raw.replace(/[%#\t\n]/g, (ch) => NAME_ESCAPES[ch]!);
}

function computeItemNames(items: readonly unknown[], idOf: (item: unknown) => string): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const id = idOf(item);
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    const encoded = encodeNamePart(id);
    return count === 1 ? `i/${encoded}` : `i/${encoded}#${count}`;
  });
}

/** Real (non-reuse) part builds since the last reset - mirrors `core/tokens/base.ts`'s own
 * `textCacheRealEncodes`: the proof that a patch's `reuse` argument actually skips re-stringifying an
 * unchanged part, not merely that the OUTPUT happens to be correct (byte-correctness alone cannot
 * distinguish "reused" from "recomputed the same bytes the slow way" - a reuse regression caught this
 * way, 2026-10-01: `content-store-patch.ts`'s `buildNextOriginal` forwarded an escrow raw value that
 * was never the SAME reference `coldFillParts` decoded, so every patch re-stringified the whole escrow
 * twin regardless of whether it changed). Never read by production code. */
let realBuilds = 0;
export function __piecePartsRealBuildsForTests(): number {
  return realBuilds;
}
export function __resetPiecePartsStatsForTests(): void {
  realBuilds = 0;
}

function buildPart(name: string, value: unknown, escrow: boolean, cached: PartRecord | undefined, kind: Kind, path: readonly (string | number)[] = [], known?: KnownBlobs): PartRecord {
  if (cached && cached.value === value) return cached;
  realBuilds++;
  const blobs = new Map<string, PartBlob>();
  const refs = new Set<string>();
  const encoded = encodeBlobs(value, escrow, blobs, kind, path, known, refs);
  const json = JSON.stringify(encoded);
  const hash = hashHex(json);
  // A hash the part already carries the bytes for is not also a bare reference.
  const bare = [...refs].filter((sha) => !blobs.has(sha));
  return { name, json, hash, blobs: [...blobs.values()], ...(bare.length ? { refs: bare } : {}), value };
}

/** Splits `original[fmt].raw` entries whose JSON exceeds the threshold out of the head. Returns the
 * head's own (unextracted) `original` and the raw values that get their own "r/<fmt>" part.
 * `reuseByName` lets an unchanged raw (the same object reference as the part `decompose` made for it
 * last time) skip `JSON.stringify` entirely: its classification cannot have changed either, and for a
 * full-size ST preset that escrow twin is the single most expensive line in this module (S5 perf
 * review, 2026-09-30 - about 70 ms on a 35 MB raw, paid on every patch otherwise). */
function splitEscrow(
  original: Original | undefined,
  reuseByName: ReadonlyMap<string, PartRecord>,
): {
  headOriginal: Original | undefined;
  rawParts: { fmt: string; raw: unknown }[];
} {
  if (!original) return { headOriginal: undefined, rawParts: [] };
  const rawParts: { fmt: string; raw: unknown }[] = [];
  // Object.fromEntries, not `headOriginal[fmt] = ...`: FormatId is an open string (core/canonical.ts),
  // so a format id literally named "__proto__" would write the prototype instead of an own property
  // under bracket assignment, silently dropping that entry (the same trap piece-parts-blob.ts guards
  // for escrow content).
  const headOriginal = Object.fromEntries(
    Object.keys(original).map((fmt) => {
      const entry = original[fmt]!;
      const priorRawPart = reuseByName.get(`r/${encodeNamePart(fmt)}`);
      if (priorRawPart && priorRawPart.value === entry.raw) {
        rawParts.push({ fmt, raw: entry.raw });
        return [fmt, { ...entry, raw: null }];
      }
      const rawJson = JSON.stringify(entry.raw);
      if (rawJson !== undefined && rawJson.length > RAW_PART_THRESHOLD) {
        rawParts.push({ fmt, raw: entry.raw });
        return [fmt, { ...entry, raw: null }];
      }
      return [fmt, entry];
    }),
  ) as Original;
  return { headOriginal, rawParts };
}

/** The split declaration for one kind, or undefined for a kind with no item parts - the same registry
 * `decompose`/`partNames` use. Exported for the patch path (S5), which needs each item's own schema
 * (`KindParts.itemSchema`) to validate one changed item without decomposing the whole entity. */
export function kindPartsFor(kind: Kind): KindParts | undefined {
  return partsOf(kind);
}

/** The item part names `decompose` would give `entity`'s own items, in array order: `[]` for a kind
 * with no split items. Exported so the patch path (S5) can recompute the names a next entity's items
 * imply and refuse a patch whose own `order` does not match them exactly - the same check this
 * function's inlining into `decompose` already made, now callable without a full decompose. */
export function partNames(entity: ParsedCanonicalEntity): string[] {
  const kindParts = partsOf(entity.kind);
  if (!kindParts) return [];
  const body = entity.body as unknown as Record<string, unknown>;
  const items = (body[kindParts.itemsField] as unknown[] | undefined) ?? [];
  return computeItemNames(items, kindParts.idOf as (item: unknown) => string);
}

/**
 * Decomposes a parsed entity into its canonical part order: "h", "o" (split kinds only), items in
 * array order, then "r/<fmt>" parts in `original`'s own key order. `reuse` is a previous decompose
 * result: an item or escrow raw value that is the *same object reference* as before keeps its cached
 * json/hash/blobs without being re-walked. Names and the head are always recomputed, since a
 * duplicate-id rename can shift which name an unchanged value now has. `known` (the patch path only)
 * names pictures the piece already holds or a patch carries: a media slot holding one of their sentinels
 * keeps it verbatim instead of being escaped as authored text.
 */
export function decompose(entity: ParsedCanonicalEntity, reuse?: readonly PartRecord[], known?: KnownBlobs): PartRecord[] {
  const reuseByName = new Map((reuse ?? []).map((p) => [p.name, p] as const));
  const kindParts = partsOf(entity.kind);
  const body = entity.body as unknown as Record<string, unknown>;
  const rawItems: unknown[] = kindParts ? ((body[kindParts.itemsField] as unknown[] | undefined) ?? []) : [];
  const itemNames = kindParts ? computeItemNames(rawItems, kindParts.idOf as (item: unknown) => string) : [];

  const { headOriginal, rawParts } = splitEscrow(entity.original, reuseByName);

  const head = { ...entity } as Record<string, unknown>;
  if (kindParts) head.body = { ...body, [kindParts.itemsField]: [] };
  if (entity.original) head.original = headOriginal;

  const result: PartRecord[] = [];
  result.push(buildPart("h", head, false, undefined, entity.kind, [], known)); // the head is rebuilt fresh every call
  if (kindParts) result.push(buildPart("o", itemNames, false, undefined, entity.kind));
  if (kindParts) {
    for (let i = 0; i < rawItems.length; i++) {
      const name = itemNames[i]!;
      result.push(buildPart(name, rawItems[i], false, reuseByName.get(name), entity.kind, ["body", kindParts.itemsField, i], known));
    }
  }
  for (const { fmt, raw } of rawParts) {
    const name = `r/${encodeNamePart(fmt)}`;
    result.push(buildPart(name, raw, true, reuseByName.get(name), entity.kind));
  }
  return result;
}

/** The JS value one part's own json decodes to, blob sentinels resolved. Exported for the patch
 * path's cold cache fill (S5): a reload from `backend.parts()` already has each part's `blobs`, so it
 * can recover the same per-part values `decompose` would have handed back without re-decomposing the
 * whole entity, letting `decompose`'s `reuse` recognise them by reference on the next patch. */
export function decodePart(part: Pick<PartRecord, "json" | "blobs">, admit?: (bytes: number) => void): unknown {
  const parsed: unknown = JSON.parse(part.json);
  if (!mayNeedBlobWalk(part.json)) return parsed; // no NUL in the text: nothing to dereference or unescape
  const blobsByKey = new Map(part.blobs.map((b) => [b.key, b] as const));
  return decodeBlobs(parsed, blobsByKey, admit);
}

/**
 * `decodePart` for the write-side cache: every canonical media slot keeps its picture sentinel and the
 * plain hashes left that way come back as `refs`. `path` is where this part's value sits in the entity.
 */
export function decodePartHolding(part: Pick<PartRecord, "json" | "blobs">, kind: string, path: readonly (string | number)[], admit?: (bytes: number) => void): { value: unknown; refs: string[] } {
  const parsed: unknown = JSON.parse(part.json);
  if (!mayNeedBlobWalk(part.json)) return { value: parsed, refs: [] };
  const refs = new Set<string>();
  const value = decodeBlobsHolding(parsed, kind, new Map(part.blobs.map((b) => [b.key, b] as const)), refs, admit, path);
  return { value, refs: [...refs] };
}

/** Full stored refs plus the payload subset a light projection needs to resolve. */
export function lightBlobNeeds(parts: readonly LightPartText[]): Map<string, { expected: string[]; selected: string[] }> {
  const byName = new Map(parts.map((part) => [part.name, part] as const));
  const head = byName.get("h");
  if (!head) throw new Error('piece-parts.light: missing the "h" part');
  const value = JSON.parse(head.text) as Record<string, unknown>;
  const expectedHead = sentinelBlobRefs(value);
  delete value.original;
  const kind = value.kind as Kind;
  const needs = new Map<string, { expected: string[]; selected: string[] }>();
  const add = (name: string, item: unknown, path: readonly (string | number)[], expected = sentinelBlobRefs(item)) => {
    const refs = lightBlobRefs(item, kind, path).textBlobs;
    needs.set(name, { expected, selected: refs });
  };
  add("h", value, [], expectedHead);
  const kindParts = partsOf(kind);
  if (kindParts) {
    const split = kindParts;
    const order = JSON.parse(byName.get("o")?.text ?? "null") as unknown;
    if (!Array.isArray(order)) throw new Error("piece-parts.light: invalid order part");
    order.forEach((name, index) => {
      if (typeof name !== "string") throw new Error("piece-parts.light: invalid item name");
      const item = byName.get(name);
      if (!item) throw new Error(`piece-parts.light: missing item part "${name}"`);
      add(name, JSON.parse(item.text), ["body", split.itemsField, index]);
    });
  }
  return needs;
}

/**
 * What opening a piece for the write-side cache needs from its blobs. Per part: every hash it
 * references (`expected`, checked against the stored links), the picture hashes the cache keeps as
 * references (`media`), and the rest, whose payload the cache must open (`selected`). A part named
 * "r/<fmt>" is escrow: nothing in it is a media slot. Throws on a split kind without its order part.
 */
export function holdingBlobNeeds(kind: Kind, parts: readonly LightPartText[]): Map<string, { expected: string[]; media: string[]; selected: string[] }> {
  const byName = new Map(parts.map((part) => [part.name, part] as const));
  const paths = new Map<string, readonly (string | number)[]>();
  const split = partsOf(kind);
  if (split) {
    const order = JSON.parse(byName.get("o")?.text ?? "null") as unknown;
    if (!Array.isArray(order)) throw new Error("piece-parts.holding: invalid order part");
    order.forEach((name, index) => { if (typeof name === "string") paths.set(name, ["body", split.itemsField, index]); });
  }
  const needs = new Map<string, { expected: string[]; media: string[]; selected: string[] }>();
  for (const part of parts) {
    const value: unknown = JSON.parse(part.text);
    const refs = lightBlobRefs(value, kind, paths.get(part.name) ?? []);
    needs.set(part.name, { expected: sentinelBlobRefs(value), media: refs.assets, selected: refs.textBlobs });
  }
  return needs;
}

/** Rebuilds the entity `decompose` produced `parts` from. Reads still validate the result with
 * `parseCanonicalEntity` (fail closed), as every other caller of a stored entity already does. Fails
 * closed on its own shape too: a missing "o" for a split kind, or a part nothing consumes, throws
 * rather than silently producing an entity fewer bytes than what was handed in (the exact shape of
 * bug the u/b blob collision caused before it was caught). */
export function assemble(parts: readonly PartRecord[], admit?: (bytes: number) => void, hold?: { kind: Kind }): ParsedCanonicalEntity {
  const decode = (part: PartRecord, path: readonly (string | number)[]): unknown =>
    hold ? decodePartHolding(part, hold.kind, path, admit).value : decodePart(part, admit);
  // Two rows under one name (a write that never closed its old row) must never let one silently win;
  // a name taken twice (an order listing an item twice) must never duplicate an item.
  const byName = new Map<string, PartRecord>();
  for (const p of parts) {
    if (byName.has(p.name)) throw new Error(`piece-parts.assemble: duplicate part "${p.name}"`);
    byName.set(p.name, p);
  }
  const consumed = new Set<string>();
  const take = (name: string): PartRecord | undefined => {
    if (consumed.has(name)) throw new Error(`piece-parts.assemble: part "${name}" taken twice`);
    const part = byName.get(name);
    if (part) consumed.add(name);
    return part;
  };

  const headPart = take("h");
  if (!headPart) throw new Error('piece-parts.assemble: missing the "h" part');
  const head = decode(headPart, []) as Record<string, unknown>;

  const kindParts = partsOf(head.kind as Kind);
  const orderPart = take("o");
  if (kindParts && !orderPart) throw new Error(`piece-parts.assemble: "${head.kind}" splits items but has no "o" part`);
  if (orderPart) {
    const order = decodePart(orderPart, admit) as string[];
    const items = order.map((name, index) => {
      const itemPart = take(name);
      if (!itemPart) throw new Error(`piece-parts.assemble: missing item part "${name}"`);
      return decode(itemPart, ["body", kindParts?.itemsField ?? "", index]);
    });
    if (kindParts) head.body = { ...(head.body as Record<string, unknown>), [kindParts.itemsField]: items };
  }

  if (head.original) {
    const original = head.original as Record<string, OriginalEntry>;
    head.original = Object.fromEntries(
      Object.keys(original).map((fmt) => {
        const entry = original[fmt]!;
        const rawPart = take(`r/${encodeNamePart(fmt)}`);
        return [fmt, rawPart ? { ...entry, raw: decode(rawPart, []) } : entry];
      }),
    );
  }

  for (const part of parts) {
    if (!consumed.has(part.name)) throw new Error(`piece-parts.assemble: part "${part.name}" was never consumed`);
  }

  return head as unknown as ParsedCanonicalEntity;
}

/** Rebuilds the editor shape without escrow or media payloads, opening only legacy text blob refs. */
export function assembleLight(parts: readonly LightPartText[], blobsByPart: ReadonlyMap<string, ReadonlyMap<string, PartBlob>> = new Map()): { entity: unknown; assets: Record<string, string> } {
  const byName = new Map(parts.map((part) => [part.name, part] as const));
  if (byName.size !== parts.length) throw new Error("piece-parts.light: duplicate part");
  const headPart = byName.get("h");
  if (!headPart) throw new Error('piece-parts.light: missing the "h" part');
  const consumed = new Set(["h"]);
  const assetHashes = new Set<string>();
  const rawHead = JSON.parse(headPart.text) as Record<string, unknown>;
  const kind = rawHead.kind as Kind;
  delete rawHead.original;
  const lightHead = lightBlobRefs(rawHead, kind);
  const head = decodeLightTextBlobs(lightHead.value, kind, blobsByPart.get("h") ?? new Map()) as Record<string, unknown>;
  lightHead.assets.forEach((sha) => assetHashes.add(sha));
  const kindParts = partsOf(kind);
  if (kindParts) {
    const split = kindParts;
    const orderPart = byName.get("o");
    if (!orderPart) throw new Error(`piece-parts.light: "${String(head.kind)}" has no order part`);
    const order = JSON.parse(orderPart.text) as unknown;
    if (!Array.isArray(order) || order.some((name) => typeof name !== "string")) throw new Error("piece-parts.light: invalid order part");
    if (new Set(order).size !== order.length) throw new Error("piece-parts.light: duplicate item name");
    consumed.add("o");
    const items = order.map((name, index) => {
      const item = byName.get(name);
      if (!item) throw new Error(`piece-parts.light: missing item part "${name}"`);
      consumed.add(name);
      const path = ["body", split.itemsField, index] as const;
      const lightValue = lightBlobRefs(JSON.parse(item.text), kind, path);
      const value = decodeLightTextBlobs(lightValue.value, kind, blobsByPart.get(name) ?? new Map(), path);
      lightValue.assets.forEach((sha) => assetHashes.add(sha));
      return value;
    });
    head.body = { ...(head.body as Record<string, unknown>), [kindParts.itemsField]: items };
  }
  if (parts.some((part) => !consumed.has(part.name))) throw new Error("piece-parts.light: unexpected non-escrow part");
  delete head.original;
  const assets = Object.fromEntries([...assetHashes].map((sha) => [sha, `/api/asset/${sha}`]));
  return { entity: head, assets };
}
