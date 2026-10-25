/**
 * Red tests for piece-parts.ts: byte identity, duplicate ids, revision sensitivity, key-order
 * independence, reuse, and the r/<fmt> threshold boundary. Blob-sentinel rules have their own file,
 * piece-parts-blob.test.ts. Scale-fixture and format-fixture sweeps live in
 * scripts/scale/piece-parts.scale.test.ts (heavier, kept out of this fast file).
 */
import { describe, expect, test } from "bun:test";
import { bytesToBase64 } from "../core/base64";
import { entityRevision } from "./canonical-revision";
import {
  fullCharacter,
  fullLorebook,
  fullPack,
  fullPersona,
  fullPreset,
  fullRegex,
  fullSurfaceEntities,
} from "./runtime-schema.full-surface.fixtures";
import { assemble, decompose, type PartRecord } from "./piece-parts";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "./runtime-schema";
import type { CanonicalPreset } from "./preset/schema";

const identical = (e: ParsedCanonicalEntity) => {
  const roundTripped = assemble(decompose(e));
  expect(JSON.stringify(roundTripped)).toBe(JSON.stringify(e));
  expect(entityRevision(roundTripped)).toBe(entityRevision(e));
};

describe("byte identity: every runtime-schema.full-surface.fixtures.ts entity", () => {
  test.each(fullSurfaceEntities.map((e) => [e.kind, e] as const))("%s", (_kind, entity) => {
    identical(parseCanonicalEntity(entity));
  });
});

test("byte identity holds for the whole fullSurfaceEntities set (sanity on the array itself)", () => {
  expect(fullSurfaceEntities.length).toBeGreaterThan(0);
});

/** A preset built for the sensitivity suite: two ordinary blocks, notes, profiles, and an escrow
 * entry whose `raw` is large enough to force its own "r/<fmt>" part (> RAW_PART_THRESHOLD), so
 * escrow-raw sensitivity is proven against the extracted-part path, not just the inline head path. */
function kitchenSinkPreset(): CanonicalPreset {
  return {
    schemaVersion: "1",
    kind: "preset",
    id: "sink",
    body: {
      name: "Kitchen Sink",
      prompts: [
        { id: "a", name: "A", content: "first", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 0, forbidOverrides: false },
        { id: "b", name: "B", content: "second", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 1, forbidOverrides: false },
      ],
    },
    profiles: { sillytavern: { name: "Kitchen Sink (ST)" } },
    notes: [{ id: "n1", text: "a note", at: "2026-09-30T00:00:00.000Z" }],
    original: {
      testfmt: {
        raw: { filler: "f".repeat(20_000) },
        unmapped: { legacy: true },
        sourceMedia: { b64: "AA==", mime: "image/png" },
      },
    },
  };
}

describe("revision sensitivity: each field alone changes the revision", () => {
  const base = parseCanonicalEntity(kitchenSinkPreset());
  const baseRevision = entityRevision(base);

  test("item text", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.body.prompts[0]!.content = "changed";
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });

  test("item order", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.body.prompts.reverse();
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });

  test("a head field", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.body.name = "Renamed";
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });

  test("notes", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.notes = [{ id: "n1", text: "edited", at: "2026-09-30T00:00:00.000Z" }];
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });

  test("profiles", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.profiles = { sillytavern: { name: "Different" } };
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });

  test("escrow raw (extracted r/<fmt> part)", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.original!.testfmt!.raw = { filler: "g".repeat(20_000) };
    const parsed = parseCanonicalEntity(next);
    expect(entityRevision(parsed)).not.toBe(baseRevision);
    // Prove it actually went through the extracted-part path, not just "h".
    expect(decompose(parsed).some((p) => p.name === "r/testfmt")).toBe(true);
  });

  test("escrow unmapped", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.original!.testfmt!.unmapped = { legacy: false };
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });

  test("sourceMedia", () => {
    const next = structuredClone(kitchenSinkPreset());
    next.original!.testfmt!.sourceMedia = { b64: "AQ==", mime: "image/png" };
    expect(entityRevision(parseCanonicalEntity(next))).not.toBe(baseRevision);
  });
});

test("key-order independence: the same content in another raw key order gives the same revision", () => {
  const a = parseCanonicalEntity({
    schemaVersion: "1",
    kind: "character",
    id: "ko",
    body: { identity: { name: "Ada" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
  });
  // Re-declared with reversed key order at every level that matters.
  const b = parseCanonicalEntity({
    kind: "character",
    schemaVersion: "1",
    body: { discovery: {}, attribution: {}, media: {}, examples: {}, greetings: {}, prompts: {}, persona: {}, identity: { name: "Ada" } },
    id: "ko",
  });
  expect(entityRevision(a)).toBe(entityRevision(b));
});

describe("duplicate ids: two items sharing one id become two parts and both survive a round trip", () => {
  const entity = parseCanonicalEntity({
    schemaVersion: "1",
    kind: "preset",
    id: "dupe",
    body: {
      name: "Dupes",
      prompts: [
        { id: "x", name: "First x", content: "one", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 0, forbidOverrides: false },
        { id: "x", name: "Second x", content: "two", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 1, forbidOverrides: false },
      ],
    },
  });

  test("names are i/x and i/x#2", () => {
    const names = decompose(entity).map((p) => p.name);
    expect(names).toContain("i/x");
    expect(names).toContain("i/x#2");
  });

  test("both items round-trip with their own content, in order", () => {
    identical(entity);
    const back = assemble(decompose(entity));
    expect((back as CanonicalPreset).body.prompts.map((p) => p.content)).toEqual(["one", "two"]);
  });
});

describe("reuse equals no-reuse in every field", () => {
  test("decompose(e, decompose(e)) matches decompose(e)", () => {
    const entity = parseCanonicalEntity(kitchenSinkPreset());
    const first = decompose(entity);
    const second = decompose(entity, first);
    expect(strip(second)).toEqual(strip(first));
  });

  test("an unchanged item kept by reference is served from the cache untouched; a changed one is not", () => {
    const entity = parseCanonicalEntity(kitchenSinkPreset()) as CanonicalPreset;
    const baseline = decompose(entity);

    const nextPrompts = entity.body.prompts.slice();
    nextPrompts[1] = { ...nextPrompts[1]!, content: "second, edited" }; // a new object at "b"
    const next = { ...entity, body: { ...entity.body, prompts: nextPrompts } };

    const withReuse = decompose(next, baseline);
    const withoutReuse = decompose(next);
    expect(strip(withReuse)).toEqual(strip(withoutReuse));

    // "a" kept the same object reference, so reuse must hand back the identical cached PartRecord.
    const cachedA = baseline.find((p) => p.name === "i/a")!;
    const reusedA = withReuse.find((p) => p.name === "i/a")!;
    expect(reusedA).toBe(cachedA);

    // "b" changed, so its hash must differ from the baseline's.
    const cachedB = baseline.find((p) => p.name === "i/b")!;
    const reusedB = withReuse.find((p) => p.name === "i/b")!;
    expect(reusedB.hash).not.toBe(cachedB.hash);
  });
});

describe("the r/<fmt> threshold: strictly greater than 16,384 JSON characters", () => {
  const build = (padLength: number): ParsedCanonicalEntity =>
    parseCanonicalEntity({
      schemaVersion: "1",
      kind: "character",
      id: "boundary",
      body: { identity: { name: "B" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
      original: { testfmt: { raw: "a".repeat(padLength) } }, // JSON.stringify -> padLength + 2 quote chars
    });

  test("exactly 16,384: stays inline, no r/<fmt> part", () => {
    const entity = build(16_382); // "..." -> length 16,384
    const names = decompose(entity).map((p) => p.name);
    expect(names).not.toContain("r/testfmt");
    identical(entity);
  });

  test("16,385: extracted into its own r/<fmt> part", () => {
    const entity = build(16_383); // "..." -> length 16,385
    const names = decompose(entity).map((p) => p.name);
    expect(names).toContain("r/testfmt");
    identical(entity);
  });
});

describe("__proto__ as an authored key: escrow JSON is third-party data, not trusted structure", () => {
  const buildWithProtoKey = (fillerLength: number): ParsedCanonicalEntity => {
    const raw = JSON.parse(`{"__proto__":{"a":1},"b":2,"filler":"${"f".repeat(fillerLength)}"}`);
    return parseCanonicalEntity({
      schemaVersion: "1",
      kind: "character",
      id: "proto",
      body: { identity: { name: "P" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
      original: { testfmt: { raw } },
    });
  };

  test("inline in the head (small raw)", () => {
    identical(buildWithProtoKey(10));
  });

  test("inside an extracted r/<fmt> part (large raw)", () => {
    const entity = buildWithProtoKey(20_000);
    expect(decompose(entity).some((p) => p.name === "r/testfmt")).toBe(true);
    identical(entity);
  });
});

describe("name encoding: authored ids and format ids can contain the name grammar's own characters", () => {
  test("a repeated id survives alongside an id already carrying a literal \"#\"", () => {
    const entity = parseCanonicalEntity({
      schemaVersion: "1",
      kind: "preset",
      id: "names",
      body: {
        name: "Names",
        prompts: [
          { id: "a", name: "1", content: "one", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 0, forbidOverrides: false },
          { id: "a", name: "2", content: "two", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 1, forbidOverrides: false },
          { id: "a#2", name: "3", content: "three", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 2, forbidOverrides: false },
        ],
      },
    });
    const names = decompose(entity).map((p) => p.name);
    // Three distinct names: the encoder escapes the authored "#" so it cannot collide with the
    // duplicate-occurrence suffix decompose generates for the id "a" on its own.
    expect(new Set(names).size).toBe(names.length);
    identical(entity);
  });

  test("an id containing a tab or a newline does not break the revision root's name\\thash lines", () => {
    const entity = parseCanonicalEntity({
      schemaVersion: "1",
      kind: "lorebook",
      id: "names",
      body: {
        name: "Names", tags: [], globalCaseSensitive: false, globalMatchWholeWords: false, globalScanDepth: 0,
        globalRecursion: false, tokenBudget: 0, budgetMode: "token", entryBudget: 0,
        entries: [{
          id: "weird\tid\nhere", title: "t", content: "c", enabled: true, constant: false,
          triggerMode: "simple", triggers: [], secondaryTriggers: [], selectiveLogic: "and_any",
          caseSensitive: null, matchWholeWords: null, scanDepth: null, position: "world", depth: 0,
          role: "system", sortOrder: 0, priority: 0, sticky: 0, cooldown: 0, delay: 0, groupName: null,
          categoryId: null, groupWeight: 0, probability: 100, useMemo: false, excludeRecursion: false,
          preventRecursion: false, delayUntilRecursion: 0, characterFilter: null,
          scanCharacterDescription: false, scanCharacterPersonality: false, scanUserPersona: false,
          scanScenario: false, ignoreBudget: false, sideEffects: null,
        }],
      },
    });
    const name = decompose(entity).find((p) => p.name.startsWith("i/"))!.name;
    expect(name).not.toContain("\t");
    expect(name).not.toContain("\n");
    identical(entity);
    expect(entityRevision(entity)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a format id containing \"#\" does not collide with an r/<fmt> or escrow item name", () => {
    const entity = parseCanonicalEntity({
      schemaVersion: "1",
      kind: "character",
      id: "fmt-hash",
      body: { identity: { name: "H" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
      original: { "fmt#weird": { raw: "a".repeat(20_000) } },
    });
    expect(decompose(entity).some((p) => p.name === "r/fmt%23weird")).toBe(true);
    identical(entity);
  });
});

test("a data URI and a bare-base64 string of the same bytes in one part dedupe without a kind collision", () => {
  const bytes = new Uint8Array(20_000).fill(9);
  const b64 = bytesToBase64(bytes);
  const entity = parseCanonicalEntity({
    schemaVersion: "1",
    kind: "character",
    id: "collide",
    body: {
      identity: { name: "C" }, persona: {}, prompts: {}, greetings: {}, examples: {},
      media: { portrait: { role: "portrait", ref: `data:image/png;base64,${b64}` } },
      attribution: {}, discovery: {},
    },
    original: { testfmt: { raw: { n: 1 }, sourceMedia: { b64, mime: "image/png" } } },
  });
  identical(entity);
});

describe("assemble fails closed rather than silently producing a short entity", () => {
  test("a split kind with no \"o\" part throws instead of assembling an empty item array", () => {
    const parts = decompose(parseCanonicalEntity(kitchenSinkPreset())).filter((p) => p.name !== "o");
    expect(() => assemble(parts)).toThrow(/no "o" part/);
  });

  test("a part nothing consumes throws instead of being silently dropped", () => {
    const parts = decompose(parseCanonicalEntity(kitchenSinkPreset()));
    const orphan: PartRecord = { name: "i/ghost", json: "{}", hash: "0".repeat(64), blobs: [], value: {} };
    expect(() => assemble([...parts, orphan])).toThrow(/never consumed/);
  });

  test("two parts with one name throw instead of one silently winning (a write that never closed its old row)", () => {
    const parts = decompose(parseCanonicalEntity(kitchenSinkPreset()));
    const head = parts.find((p) => p.name === "h")!;
    const tampered: PartRecord = { ...head, json: head.json.replace(/"name":"[^"]*"/, '"name":"TAMPERED"') };
    expect(() => assemble([...parts, tampered])).toThrow(/duplicate part/);
    const item = parts.find((p) => p.name.startsWith("i/"))!;
    expect(() => assemble([...parts, { ...item }])).toThrow(/duplicate part/);
  });

  test("an order naming one item twice throws instead of duplicating that item", () => {
    const parts = decompose(parseCanonicalEntity(kitchenSinkPreset()));
    const order = parts.find((p) => p.name === "o")!;
    const names = JSON.parse(order.json) as string[];
    const doubled = JSON.stringify([...names, names[0]]);
    expect(() => assemble(parts.map((p) => (p.name === "o" ? { ...p, json: doubled, value: JSON.parse(doubled) } : p)))).toThrow(/twice/);
  });

  test("an unresolvable blob sentinel throws instead of leaking sentinel text into the entity", () => {
    const entity = parseCanonicalEntity({
      schemaVersion: "1",
      kind: "character",
      id: "orphan-blob",
      body: { identity: { name: "O" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
      original: { testfmt: { raw: { n: 1 }, sourceMedia: { b64: bytesToBase64(new Uint8Array(20_000).fill(4)), mime: "image/png" } } },
    });
    const parts = decompose(entity).map((p) => ({ ...p, blobs: [] })); // remove every supplied blob, including split escrow
    expect(() => assemble(parts)).toThrow(/unresolved blob/);
  });
});

function strip(parts: readonly PartRecord[]) {
  return parts.map((p) => ({
    name: p.name,
    json: p.json,
    hash: p.hash,
    blobs: p.blobs.map((b) => b.key).sort(),
  }));
}

test("every exported fixture is reachable (guards the import list above against a silent drop)", () => {
  expect([fullCharacter, fullLorebook, fullPersona, fullPreset, fullRegex, fullPack].length).toBe(6);
});
