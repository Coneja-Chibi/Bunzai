/**
 * Perf-silly-fast.md R5, Phase 3 step 3.3: `StudioStore.inventory`/`list`/`graveyard` now read
 * `content.summaries`/`content.graveSummaries` (never opening a body), instead of the old
 * `content.inventory` + per-row `content.read`. This proves the two paths agree: for one full-surface
 * fixture of every kind that carries shelf/peek facts, the summary-derived `EntitySummary` (what the
 * new reader returns) equals the body-derived one (what the old reader computed, still reachable
 * through `content.read` + `summaryOfPiece`/`summaryContentOf` for this comparison alone), field for
 * field, including the `facts` the Library's meta loops and `peekPiece` now read instead of fetching
 * a body per piece.
 */
import { describe, expect, test } from "bun:test";
import type { DocumentBackend } from "../stage/contracts/content-store";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { summaryContentOf } from "../stage/store/summary-content";
import { fullCharacter, fullLorebook, fullPersona, fullPreset, fullRegex } from "../entities/runtime-schema.full-surface.fixtures";
import { summaryOfPiece } from "./store-listing";
import { StudioStore } from "./store";

const fixtures = [fullCharacter, fullLorebook, fullPersona, fullPreset, fullRegex];

describe("StudioStore.list: the summary-derived listing equals the body-derived one", () => {
  for (const fixture of fixtures) {
    test(`${fixture.kind}: every listing field, including facts, matches a direct body read`, async () => {
      const content = createContentStore(memoryDocumentBackend());
      const store = new StudioStore("/unused", () => content);
      const created = await content.create(fixture);
      if (created.status !== "saved") throw new Error("setup: create failed");

      const [wired] = await store.list(fixture.kind);
      expect(wired).toBeDefined();

      // The body-derived expectation: read the body back and compute both halves the old reader did.
      const stored = await content.read(fixture.kind, fixture.id);
      if (!stored) throw new Error("setup: read failed");
      const base = summaryOfPiece(fixture.kind, fixture.id, stored.entity, stored.version);
      const peek = summaryContentOf(stored.entity);

      expect(wired!.id).toBe(base.id);
      expect(wired!.kind).toBe(base.kind);
      expect(wired!.name).toBe(base.name);
      expect(wired!.importedAt).toBe(base.importedAt);
      expect(wired!.hasPortrait).toBe(base.hasPortrait ?? false);
      expect(wired!.accent).toBe(base.accent);
      expect(wired!.sourceFormat).toBe(base.sourceFormat);
      expect(wired!.sourceVariant).toBe(base.sourceVariant);
      expect(wired!.tags).toEqual(base.tags);
      expect(wired!.version).toBe(base.version);

      expect(wired!.facts?.tagline).toBe(peek.tagline);
      expect(wired!.facts?.description).toBe(peek.description);
      expect(wired!.facts?.tokens).toBe(peek.tokens);
      expect(wired!.facts?.filled).toBe(peek.filled);
      expect(wired!.facts?.samplers).toEqual(peek.samplers);
      expect(wired!.facts?.blocks).toBe(peek.blocks);
      expect(wired!.facts?.regex).toEqual(peek.regex);
      expect(wired!.facts?.lore).toEqual(peek.lore);
      expect(wired!.facts?.persona).toEqual(peek.persona);
    });
  }

  test("a row whose summary is stale (older DERIVED_VERSION) still lists correctly, computed fresh for that row alone", async () => {
    const backend = memoryDocumentBackend();
    const content = createContentStore(backend);
    const store = new StudioStore("/unused", () => content);
    await content.create(fullCharacter);
    // Poison the summary the way an older build would have left it: present, but stamped stale.
    const row = await backend.get("character", fullCharacter.id);
    await backend.rewriteSummary("character", fullCharacter.id, row!.version, { text: "{}", derivedVersion: "0" }, Date.now());

    const [wired] = await store.list("character");
    expect(wired!.name).toBe(summaryOfPiece("character", fullCharacter.id, fullCharacter).name);
    expect(wired!.facts?.tokens).toBeGreaterThan(0);
  });

  test("graveyard: a buried piece's name comes off its summary, matching the body-derived name", async () => {
    const content = createContentStore(memoryDocumentBackend());
    const store = new StudioStore("/unused", () => content);
    await content.create(fullLorebook);
    await content.delete("lorebook", fullLorebook.id);

    const [grave] = await store.graveyard("lorebook");
    expect(grave!.name).toBe(summaryOfPiece("lorebook", fullLorebook.id, fullLorebook).name);
  });
});

/** Counts calls to the two backend methods that open a body: `get` (one row) and `list` (every row). */
function countingBodyReads(inner: DocumentBackend): { backend: DocumentBackend; getCalls: () => number; listCalls: () => number } {
  let getCalls = 0;
  let listCalls = 0;
  return {
    backend: {
      ...inner,
      async get(kind, id) {
        getCalls++;
        return inner.get(kind, id);
      },
      async list(kind) {
        listCalls++;
        return inner.list(kind);
      },
    },
    getCalls: () => getCalls,
    listCalls: () => listCalls,
  };
}

describe("StudioStore.inventory/list/graveyard never open a body when every summary is current", () => {
  test("list, inventory, and graveyard call neither backend.get nor backend.list", async () => {
    const raw = memoryDocumentBackend();
    const counting = countingBodyReads(raw);
    const content = createContentStore(counting.backend);
    await content.create(fullCharacter);
    await content.create(fullLorebook);
    const buried = await content.create(fullPersona);
    if (buried.status !== "saved") throw new Error("setup failed");
    await content.delete("persona", fullPersona.id);

    const store = new StudioStore("/unused", () => content);
    await store.list();
    await store.inventory();
    await store.graveyard();

    // Red on the pre-3.3 StudioStore: `inventory` called `content.inventory` (a `backend.list`) and
    // then `content.read` (a `backend.get`) per row, so this would report far more than 0 for both.
    expect(counting.getCalls()).toBe(0);
    expect(counting.listCalls()).toBe(0);
  });
});
