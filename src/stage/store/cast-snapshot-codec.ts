/** Opaque ChatStore snapshot parts, encoded with the piece blob owner without canonical parsing. */
import { hashHex, isSha256Hex } from "../../core/sha256";
import { isRecord as plain } from "../../core/guards";
import { portraitBytes } from "../../studio/portrait";
import { decodeBlobs, decodeLightTextBlobs, encodeBlobs, lightBlobRefs, sentinelBlobRefs } from "../../entities/piece-parts-blob";
import type { PartBlob, PartText } from "../contracts/content-store";
import type { CastSnapshot, CastSnapshotCodec, JsonObject } from "../contracts/chat-store";

const members = ["character", "persona"] as const;
type Member = (typeof members)[number];

const blobsFor = (value: unknown, kind: Member): { value: unknown; blobs: PartBlob[] } => {
  const blobs = new Map<string, PartBlob>();
  const encoded = encodeBlobs(value, true, blobs, kind);
  return { value: encoded, blobs: [...blobs.values()] };
};

const stableJson = (value: unknown): string => {
  const sorted = (function sort(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(sort);
    if (plain(item)) return Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]));
    return item;
  })(value);
  const text = JSON.stringify(sorted);
  if (text === undefined) throw new Error("cast snapshot part is not JSON");
  return text;
};

const portrait = (snapshot: CastSnapshot): PartText | null => {
  const art = portraitBytes(snapshot.character as never);
  if (!art) return { name: "art/character", text: JSON.stringify({ sha: null, mime: null }), blobs: [] };
  const sha = hashHex(art.bytes);
  return {
    name: "art/character",
    text: JSON.stringify({ sha, mime: art.mime }),
    blobs: [{ key: sha, payload: { kind: "bytes", bytes: art.bytes } }],
  };
};

const lightValue = (part: Pick<PartText, "name" | "text">): { member: Member; value: Record<string, unknown>; refs: ReturnType<typeof lightBlobRefs>; expected: string[] } => {
  if (part.name !== "character" && part.name !== "persona") throw new Error("cast light projection needs a member skeleton");
  const value = JSON.parse(part.text) as unknown;
  if (!plain(value)) throw new Error(`cast snapshot ${part.name} part is not an object`);
  const expected = sentinelBlobRefs(value);
  delete value["original"];
  const body = value["body"];
  if (plain(body)) body["media"] = null;
  return { member: part.name, value, refs: lightBlobRefs(value, part.name), expected };
};

function decodePart(part: PartText): unknown {
  const value = JSON.parse(part.text) as unknown;
  const refs = new Set(sentinelBlobRefs(value));
  const blobs = new Map(part.blobs.map((blob) => [blob.key, blob] as const));
  if (refs.size !== blobs.size || [...refs].some((key) => !blobs.has(key))) throw new Error(`cast snapshot ${part.name} has corrupt blob topology`);
  return decodeBlobs(value, blobs);
}

export const castSnapshotCodec: CastSnapshotCodec = {
  prepare(snapshot) {
    const parts: PartText[] = members.flatMap((member) => {
      const value = snapshot[member];
      if (value === undefined) return [];
      const skeleton = structuredClone(value) as Record<string, unknown>;
      const out: PartText[] = [];
      if (Object.hasOwn(skeleton, "original")) {
        const encoded = blobsFor(skeleton["original"], member);
        out.push({ name: `${member}/original`, text: stableJson(encoded.value), blobs: encoded.blobs });
        skeleton["original"] = null;
      }
      const body = skeleton["body"];
      if (plain(body) && Object.hasOwn(body, "media")) {
        const encoded = blobsFor(body["media"], member);
        out.push({ name: `${member}/media`, text: stableJson(encoded.value), blobs: encoded.blobs });
        body["media"] = null;
      }
      const encoded = blobsFor(skeleton, member);
      out.unshift({ name: member, text: stableJson(encoded.value), blobs: encoded.blobs });
      return out;
    });
    const art = portrait(snapshot);
    if (art) parts.push(art);
    return parts;
  },

  assemble(parts) {
    const byName = new Map<string, PartText>();
    for (const part of parts) {
      if (byName.has(part.name)) throw new Error(`duplicate cast snapshot part ${part.name}`);
      if (!["character", "persona", "character/original", "character/media", "persona/original", "persona/media", "art/character"].includes(part.name)) {
        throw new Error(`unknown cast snapshot part ${part.name}`);
      }
      byName.set(part.name, part);
    }
    for (const member of members) {
      const supplemental = [`${member}/original`, `${member}/media`];
      if (!byName.has(member) && supplemental.some((name) => byName.has(name))) throw new Error(`cast snapshot has an orphan ${member} part`);
      const skeleton = byName.get(member);
      if (!skeleton) continue;
      const shape = JSON.parse(skeleton.text) as unknown;
      if (!plain(shape)) throw new Error(`cast snapshot ${member} part is not an object`);
      const originalPart = byName.has(`${member}/original`);
      if (Object.hasOwn(shape, "original") !== originalPart || (originalPart && shape["original"] !== null)) throw new Error(`cast snapshot ${member} original part topology is corrupt`);
      const body = shape["body"];
      const mediaPart = byName.has(`${member}/media`);
      const mediaSlot = plain(body) && Object.hasOwn(body, "media");
      if (mediaSlot !== mediaPart || (mediaPart && (!plain(body) || body["media"] !== null))) throw new Error(`cast snapshot ${member} media part topology is corrupt`);
    }
    if (byName.has("art/character") && !byName.has("character")) throw new Error("cast snapshot has an orphan character portrait");
    const read = (member: Member): JsonObject | undefined => {
      const part = byName.get(member);
      if (!part) return undefined;
      const value = decodePart(part) as Record<string, unknown>;
      const original = byName.get(`${member}/original`);
      const media = byName.get(`${member}/media`);
      if (original) value["original"] = decodePart(original);
      if (media && plain(value["body"])) (value["body"] as Record<string, unknown>)["media"] = decodePart(media);
      return value as JsonObject;
    };
    const character = read("character");
    if (!character) throw new Error("cast snapshot is missing its character part");
    const persona = read("persona");
    const art = byName.get("art/character");
    if (art) {
      const reference = castSnapshotCodec.portraitReference(art);
      if (reference ? art.blobs.length !== 1 || art.blobs[0]?.key !== reference.sha || art.blobs[0]?.payload.kind !== "bytes" : art.blobs.length !== 0) {
        throw new Error("cast snapshot portrait blob is corrupt");
      }
    } else throw new Error("cast snapshot is missing its portrait metadata part");
    return { character, ...(persona ? { persona } : {}) };
  },

  light(parts, selectedOnly = false) {
    const out: Partial<CastSnapshot> = {};
    for (const member of members) {
      const part = parts.find((candidate) => candidate.name === member);
      if (!part) continue;
      const light = lightValue(part);
      const selected = new Set(light.refs.authoredTextBlobs);
      if ([...selected].some((key) => !light.expected.includes(key))) throw new Error(`cast snapshot ${member} selected an unexpected blob`);
      const provided = new Map(part.blobs.map((blob) => [blob.key, blob] as const));
      if (provided.size !== part.blobs.length) throw new Error(`cast snapshot ${member} has duplicate blob payloads`);
      if (selectedOnly) {
        if (provided.size !== selected.size || [...provided.keys()].some((key) => !selected.has(key))) throw new Error(`cast snapshot ${member} has an invalid selected blob set`);
      } else if (provided.size !== light.expected.length || light.expected.some((key) => !provided.has(key))) {
        throw new Error(`cast snapshot ${member} has corrupt blob topology`);
      }
      const blobs = new Map([...provided].filter(([key]) => selected.has(key)));
      if (blobs.size !== selected.size) throw new Error(`cast snapshot ${member} is missing authored text blobs`);
      out[member] = decodeLightTextBlobs(light.refs.value, member, blobs, [], true, true) as JsonObject;
    }
    if (!out.character) throw new Error("cast snapshot is missing its character part");
    return out as CastSnapshot;
  },

  lightBlobKeys(part) {
    const light = lightValue(part);
    return { expected: light.expected, selected: light.refs.authoredTextBlobs };
  },

  portrait,

  portraitReference(part, metadataOnly = false) {
    if (!part) return null;
    if (part.name !== "art/character") throw new Error("cast portrait reference has an unexpected part name");
    const value = JSON.parse(part.text) as unknown;
    if (!plain(value)) throw new Error("cast portrait reference is malformed");
    if (value["sha"] === null && value["mime"] === null) {
      if (!metadataOnly && part.blobs.length !== 0) throw new Error("empty cast portrait has blob references");
      return null;
    }
    if (!isSha256Hex(value["sha"]) ||
      typeof value["mime"] !== "string" || value["mime"].length === 0 || value["mime"].length > 100) {
      throw new Error("cast portrait reference is malformed");
    }
    if (!metadataOnly && (part.blobs.length !== 1 || part.blobs[0]?.key !== value["sha"] || part.blobs[0]?.payload.kind !== "bytes")) {
      throw new Error("cast portrait blob reference is corrupt");
    }
    return { sha: value["sha"], mime: value["mime"] };
  },
};
