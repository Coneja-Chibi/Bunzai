/** Snapshot codec regressions: arbitrary JSON stays exact and corrupt part topology fails closed. */
import { expect, test } from "bun:test";
import type { CastSnapshot } from "../contracts/chat-store";
import { castSnapshotCodec } from "./cast-snapshot-codec";

const snapshot = {
  character: {
    id: "vera",
    original: { raw: { extension: "x".repeat(18_000) } },
    body: { description: "An authored line", media: { portrait: { ref: "data:image/png;base64,AQID" } }, extension: { keep: true } },
  },
  persona: { id: "voice", custom: { value: "kept" } },
} as unknown as CastSnapshot;

test("snapshot codec preserves arbitrary JSON and always records portrait presence", () => {
  const parts = castSnapshotCodec.prepare(snapshot);
  expect(castSnapshotCodec.assemble(parts)).toEqual(snapshot);
  expect(castSnapshotCodec.portraitReference(parts.find((part) => part.name === "art/character") ?? null)).toMatchObject({ mime: "image/png" });
  const noArt = castSnapshotCodec.prepare({ character: { id: "plain" } } as unknown as CastSnapshot);
  expect(castSnapshotCodec.portraitReference(noArt.find((part) => part.name === "art/character") ?? null)).toBeNull();
});

test("snapshot codec rejects orphan supplemental parts, missing portrait metadata, and mismatched refs", () => {
  const parts = castSnapshotCodec.prepare(snapshot);
  expect(() => castSnapshotCodec.assemble(parts.filter((part) => part.name !== "character/original"))).toThrow("original part topology is corrupt");
  expect(() => castSnapshotCodec.assemble(parts.filter((part) => part.name !== "art/character"))).toThrow("missing its portrait metadata part");
  const art = parts.find((part) => part.name === "art/character")!;
  expect(() => castSnapshotCodec.assemble(parts.map((part) => part === art ? { ...part, blobs: [] } : part))).toThrow("portrait blob reference is corrupt");
});

test("light snapshots preserve authored prose, base64 and data URIs but omit declared media", () => {
  const prose = "ordinary authored prose ".repeat(900);
  const base64 = "A".repeat(18_000);
  const uri = `data:image/png;base64,${"C".repeat(18_000)}`;
  const value = {
    character: {
      id: "vera",
      description: prose,
      custom: { base64, dataUri: uri },
      body: { presentation: { background: { ref: "B".repeat(18_000) } } },
    },
  } as unknown as CastSnapshot;
  const parts = castSnapshotCodec.prepare(value);
  const lightParts = parts.filter((part) => part.name === "character" || part.name === "persona");
  const refs = castSnapshotCodec.lightBlobKeys(lightParts[0]!);
  expect(refs.selected).toHaveLength(3);
  expect(refs.expected).toHaveLength(4);
  const projected = castSnapshotCodec.light(lightParts);
  expect(projected.character.description).toBe(prose);
  expect((projected.character.custom as Record<string, unknown>).base64).toBe(base64);
  expect((projected.character.custom as Record<string, unknown>).dataUri).toBe(uri);
  expect(((projected.character.body as Record<string, unknown>).presentation as Record<string, unknown>).background).toEqual({ ref: null });
});
