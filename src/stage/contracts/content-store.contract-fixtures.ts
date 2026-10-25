/**
 * Shared pieces of the ContentStore contract suites (content-store.contract.ts and
 * content-store-concurrency.contract.ts): a character, a planted row, and the rig every test runs on.
 */
import { bytesToBase64 } from "../../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { decompose } from "../../entities/piece-parts";
import type { PresetPrompt } from "../../entities/preset/schema";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { buildPartText } from "../store/content-store-write";
import { createContentStore } from "../store/content-store";
import type { ContentStore, DocumentBackend } from "./content-store";

export const character = (id: string, name = id) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id,
  body: {
    identity: { name },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  },
});

const block = (id: string, content: string): PresetPrompt => ({
  id,
  name: id,
  content,
  role: "system",
  enabled: true,
  systemPrompt: false,
  marker: false,
  placement: "relative",
  injectionDepth: 0,
  injectionOrder: 0,
  forbidOverrides: false,
});

/** Deterministic art bytes over the 16 KB blob threshold (16,384 base64 chars decode to exactly
 * 12,288 bytes), for the blob-dedup contract tests.
 * `seed` varies the content so two calls can produce two DIFFERENT blobs when a test needs that. */
export const artBytes = (seed = 0): Uint8Array => new Uint8Array(12_288).map((_, i) => (i * 37 + 11 + seed) % 256);
export const artDataUri = (seed = 0): string => `data:image/png;base64,${bytesToBase64(artBytes(seed))}`;

/** A character carrying a portrait data URI and, when `sourceMediaB64` is given, an escrow entry
 * whose `sourceMedia.b64` is the SAME bytes as bare base64 - the "arrived as a PNG" shape where a
 * card's own art and its escrow twin share one blob. */
export function characterWithArt(id: string, art: string, sourceMediaB64?: string) {
  const base = character(id);
  return {
    ...base,
    body: { ...base.body, media: { portrait: { role: "portrait" as const, ref: art } } },
    ...(sourceMediaB64 ? { original: { sillytavern: { raw: { name: id }, sourceMedia: { b64: sourceMediaB64, mime: "image/png" } } } } : {}),
  };
}

/** A persona carrying the same portrait slot a character does (`entities/persona/schema.ts:125`),
 * for the "a blob shared across different kinds" test. */
export const personaWithArt = (id: string, art: string) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "persona",
  id,
  body: { name: id, content: "", media: { portrait: { role: "portrait" as const, ref: art } } },
});

/** A split-kind entity (items AND escrow), for the part-diff tests: two blocks and one escrow `raw`
 * over the 16 KB threshold (Appendix A section D), so editing one block can be proven to touch only
 * that block's own part row - never "o", the other block, or the escrow. */
export const presetWithEscrow = (id: string, blockAContent = "original") => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset",
  id,
  body: { name: "P", prompts: [block("a", blockAContent), block("b", "second")] },
  original: { testfmt: { raw: { filler: "f".repeat(20_000) }, unmapped: {} } },
});

/** A valid, live row written straight to the backend, as if some other writer had put it there. Its
 * parts are a real `decompose` of `character(id)`, so anything that reads it back (`store.read`, a
 * rebuild) assembles the exact same entity, not a stand-in nothing ever opens. */
export function plantLive(backend: DocumentBackend, id: string): Promise<boolean> {
  const parts = decompose(parseCanonicalEntity(character(id)));
  return backend.write(
    { kind: "character", id, revision: "planted", version: 1, writeId: 1, autosaveStartedAt: null, createdAt: 1, updatedAt: 1 },
    { kind: "character", id, version: 1, revision: "planted", savedAt: 1, reason: "create", autosaveStartedAt: null },
    { when: "always" },
    null,
    { put: parts.map(buildPartText), drop: [] },
  );
}

export interface Rig {
  store: ContentStore;
  backend: DocumentBackend;
  setNow(ms: number): void;
}

export const rigFor = (makeBackend: () => DocumentBackend) => (): Rig => {
  let now = 1_000;
  const backend = makeBackend();
  return { store: createContentStore(backend, () => now), backend, setNow: (ms) => { now = ms; } };
};
