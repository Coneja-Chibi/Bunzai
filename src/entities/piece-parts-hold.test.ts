/**
 * Pictures kept by reference: a media slot's sentinel survives a decode and a re-encode when the piece holds
 * (or a patch carries) the blob, authored text can still never impersonate a reference, and the part says which
 * hashes it points at without carrying their bytes.
 */
import { expect, test } from "bun:test";
import { bytesToBase64 } from "../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { hashHex } from "../core/sha256";
import { decodeAuthorizedBlobsHolding, SENTINEL_PREFIX, UnresolvedBlobError, type PartBlob } from "./piece-parts-blob";
import { decodePartHolding, decompose, holdingBlobNeeds } from "./piece-parts";
import { parseCanonicalEntity } from "./runtime-schema";

const bytes = new Uint8Array(20_000).map((_, i) => (i * 13 + 5) % 256);
const sha = hashHex(bytes);
const sentinel = `${SENTINEL_PREFIX}u:image/png:${sha}`;
const pack = (ref: string) => parseCanonicalEntity({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "p", body: { name: "P", pack: { items: [{ id: "a", label: "a", ref }] } } });
const dataUri = `data:image/png;base64,${bytesToBase64(bytes)}`;

test("a piece decomposed from a data URI decodes in hold mode to its sentinel and its hash, with no bytes", () => {
  const [head] = decompose(pack(dataUri));
  expect(head!.blobs).toHaveLength(1);
  const held = decodePartHolding({ json: head!.json, blobs: [] }, "pack", []);
  expect(held.refs).toEqual([sha]);
  expect((held.value as { body: { pack: { items: { ref: string }[] } } }).body.pack.items[0]!.ref).toBe(sentinel);
});

test("a sentinel the piece holds is kept verbatim and recorded as a reference, never as a payload", () => {
  const [head] = decompose(pack(sentinel), undefined, { blobs: new Map(), held: new Set([sha]) });
  expect(head!.blobs).toEqual([]);
  expect(head!.refs).toEqual([sha]);
  expect(JSON.parse(head!.json).body.pack.items[0].ref).toBe(sentinel);
});

test("a sentinel a patch carries bytes for is kept and its payload rides with the part", () => {
  const blob: PartBlob = { key: sha, payload: { kind: "bytes", bytes } };
  const [head] = decompose(pack(sentinel), undefined, { blobs: new Map([[sha, blob]]), held: new Set() });
  expect(head!.blobs).toEqual([blob]);
  expect(head!.refs).toBeUndefined();
});

test("without being told the piece holds it, a sentinel in a media slot is only authored text, escaped", () => {
  const [head] = decompose(pack(sentinel));
  expect(head!.blobs).toEqual([]);
  expect(head!.refs).toBeUndefined();
  expect(JSON.parse(head!.json).body.pack.items[0].ref).toBe(SENTINEL_PREFIX + sentinel);
});

test("a sentinel outside a media slot is never held, even for a hash the piece holds", () => {
  const entity = parseCanonicalEntity({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "p", body: { name: sentinel, pack: { items: [] } } });
  const [head] = decompose(entity, undefined, { blobs: new Map(), held: new Set([sha]) });
  expect(head!.refs).toBeUndefined();
  expect(JSON.parse(head!.json).body.name).toBe(SENTINEL_PREFIX + sentinel);
});

test("authorizing a head: a held or carried picture passes, anything else is refused", () => {
  const head = { body: { pack: { items: [{ ref: sentinel }] } } };
  const blob: PartBlob = { key: sha, payload: { kind: "bytes", bytes } };
  expect(decodeAuthorizedBlobsHolding(head, "pack", new Map(), new Set([sha]))).toEqual(head);
  expect(decodeAuthorizedBlobsHolding(head, "pack", new Map([[sha, blob]]), new Set())).toEqual(head);
  expect(() => decodeAuthorizedBlobsHolding(head, "pack", new Map(), new Set())).toThrow(UnresolvedBlobError);
});

test("blob needs separate the pictures a cache keeps from the text it must open", () => {
  const escrowText = "plain escrow words ".repeat(1_200); // not base64, so it becomes a text blob
  const entity = parseCanonicalEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "c", body: { identity: { name: "C" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: { portrait: { role: "portrait", ref: dataUri } }, attribution: {}, discovery: {} },
    original: { fmt: { raw: { big: escrowText }, unmapped: {} } },
  });
  const parts = decompose(entity).map(({ name, json }) => ({ name, text: json }));
  const needs = holdingBlobNeeds("character", parts);
  const all = [...needs.values()];
  expect(all.flatMap((n) => n.media)).toEqual([sha]);
  expect(all.flatMap((n) => n.selected)).toEqual([hashHex(escrowText)]);
  expect(all.flatMap((n) => n.expected).sort()).toEqual([sha, hashHex(escrowText)].sort());
});

test("a hash a part carries the bytes for is never also listed as a bare reference", () => {
  const entity = parseCanonicalEntity({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "p", body: { name: "P", pack: { items: [{ id: "a", label: "a", ref: sentinel }, { id: "b", label: "b", ref: dataUri }] } } });
  const [head] = decompose(entity, undefined, { blobs: new Map(), held: new Set([sha]) });
  expect(head!.blobs.map((blob) => blob.key)).toEqual([sha]);
  expect(head!.refs).toBeUndefined();
});
