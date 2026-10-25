/**
 * The patch path contract: run by `content-store.contract.ts` for every backend. The differential proof drives small,
 * cheap random patch sequences (never the 30 MB scale fixtures - that is `scripts/scale`'s job for the
 * timing gates) against a fixture carrying a duplicate id pair, an over-16-KB escrow `raw`, and a
 * BOM-prefixed text payload (the exact shape S4b's own BOM fix, commit 1842d2b, proved for blobs), so
 * the patch path exercises the same blob and escrow machinery the whole-entity path already does.
 */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { mulberry32 as prng } from "../../core/lore/rng";
import { entityRevision } from "../../entities/canonical-revision";
import { __piecePartsRealBuildsForTests, __resetPiecePartsStatsForTests } from "../../entities/piece-parts";
import type { PresetPrompt } from "../../entities/preset/schema";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { StudioValidationError } from "../../studio/errors";
import { createContentStore } from "../store/content-store";
import { buildSummary } from "../store/summary-content";
import type { PiecePatch } from "./content-store";
import type { Rig } from "./content-store.contract-fixtures";

/** `read()`'s `entity.body` types as the union of every kind's body; every fixture here is a preset,
 * so test assertions narrow through this cast rather than repeating it inline. */
function presetBodyOf(entity: ParsedCanonicalEntity): { name: string; prompts: PresetPrompt[] } {
  return entity.body as unknown as { name: string; prompts: PresetPrompt[] };
}

// -- the fuzz model: a preset as items plus a head field plus two escrow formats -----------------

interface Item {
  key: number;
  id: string;
  content: string;
}
interface State {
  items: Item[];
  headName: string;
  /** "testfmt": always present, always over the 16 KB escrow threshold, BOM-prefixed non-base64
   * text (S4b's own blob-text-fallback rule), so every sequence exercises a blob read and write. */
  bigRaw: string;
  /** "sidecar": a SECOND over-threshold escrow format, mutated only by the "original" op, so
   * `patch.original` is exercised distinctly from a head-only change. */
  sidecarRaw: string;
}

let nextKey = 0;
const freshItem = (id: string, content: string): Item => ({ key: nextKey++, id, content });

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

/** `piece-parts.ts`'s own duplicate-occurrence naming, reimplemented here (ids never need percent
 * escaping in this fixture) so the test can predict a patch's exact part names independently of the
 * module under test. */
function computeNames(items: readonly Item[]): string[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const n = (seen.get(it.id) ?? 0) + 1;
    seen.set(it.id, n);
    return n === 1 ? `i/${it.id}` : `i/${it.id}#${n}`;
  });
}

/** The BOM character the escrow fixture's big text blob starts with (S4b's own fix, commit 1842d2b):
 * named here so the test below can assert it survives, rather than repeating the literal twice. */
const BOM = "﻿";

function initialState(): State {
  nextKey = 0;
  return {
    items: [freshItem("dup", "first"), freshItem("b", "B"), freshItem("dup", "second"), freshItem("c", "C")],
    headName: "Scale Preset",
    bigRaw: BOM + "deterministic preset escrow content ".repeat(500), // > 16 KB, BOM-prefixed text blob
    sidecarRaw: "sidecar escrow payload one ".repeat(700), // > 16 KB
  };
}

function entityOf(state: State): unknown {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id: "p1",
    body: { name: state.headName, prompts: state.items.map((it) => block(it.id, it.content)) },
    original: {
      testfmt: { raw: { big: state.bigRaw }, unmapped: {} },
      sidecar: { raw: { big: state.sidecarRaw } },
    },
  };
}

type Op =
  | { kind: "edit"; index: number; newContent: string }
  | { kind: "add"; index: number; id: string; content: string }
  | { kind: "remove"; index: number }
  | { kind: "reorder"; permutation: number[] }
  | { kind: "head"; newName: string }
  | { kind: "original"; newSidecar: string };

let addCounter = 0;

function pickOp(rng: () => number, state: State): Op {
  const n = state.items.length;
  const choices: Op["kind"][] = ["edit", "add", "head", "original"];
  if (n > 1) choices.push("remove", "reorder");
  const kind = choices[Math.floor(rng() * choices.length)]!;
  switch (kind) {
    case "edit":
      return { kind, index: Math.floor(rng() * n), newContent: `edited-${Math.floor(rng() * 1e9)}` };
    case "add":
      return { kind, index: Math.floor(rng() * (n + 1)), id: `new-${addCounter++}`, content: `added-${Math.floor(rng() * 1e9)}` };
    case "remove":
      return { kind, index: Math.floor(rng() * n) };
    case "reorder": {
      const perm = Array.from({ length: n }, (_, i) => i);
      for (let i = perm.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [perm[i], perm[j]] = [perm[j]!, perm[i]!];
      }
      return { kind, permutation: perm };
    }
    case "head":
      return { kind, newName: `Scale Preset ${Math.floor(rng() * 1e9)}` };
    case "original":
      return { kind, newSidecar: `sidecar escrow payload ${Math.floor(rng() * 1e9)} `.repeat(700) };
  }
}

function applyWhole(state: State, op: Op): State {
  switch (op.kind) {
    case "edit": {
      const items = state.items.slice();
      items[op.index] = { ...items[op.index]!, content: op.newContent };
      return { ...state, items };
    }
    case "add": {
      const items = state.items.slice();
      items.splice(op.index, 0, freshItem(op.id, op.content));
      return { ...state, items };
    }
    case "remove":
      return { ...state, items: state.items.filter((_, i) => i !== op.index) };
    case "reorder":
      return { ...state, items: op.permutation.map((i) => state.items[i]!) };
    case "head":
      return { ...state, headName: op.newName };
    case "original":
      return { ...state, sidecarRaw: op.newSidecar };
  }
}

/**
 * Every surviving item (matched by its test-only `key`, never its authored `id`) whose part NAME
 * changed between `state` and `nextState` - not only a remove's "renames the second of a duplicate
 * pair", but ANY op that changes a same-id pair's relative
 * order, since an item's occurrence suffix is positional. The cache's "unchanged items reused by
 * reference" lookup is BY NAME, so a renamed-but-unedited item must be resent under its new name or
 * the patch would silently apply the WRONG cached value to that name (the old occupant of the name
 * it is taking over) instead of carrying its own content forward.
 */
function renamedSurvivors(state: State, nextState: State): Record<string, unknown> {
  const oldNameByKey = new Map(state.items.map((it, i) => [it.key, computeNames(state.items)[i]!]));
  const newNames = computeNames(nextState.items);
  const items: Record<string, unknown> = {};
  nextState.items.forEach((it, i) => {
    const oldName = oldNameByKey.get(it.key);
    const newName = newNames[i]!;
    if (oldName !== undefined && oldName !== newName) items[newName] = block(it.id, it.content);
  });
  return items;
}

/** Builds the exact `PiecePatch` a correct client would send for `op`, derived from `state`'s own
 * names rather than anything the store caches - a true black-box client, so the differential proof
 * below is never tautological with the module it exercises. */
function buildPatch(state: State, nextState: State, op: Op): PiecePatch {
  // Both escrow formats in this fixture are always over the 16 KB threshold, so the head always
  // carries their placeholder (null `raw`) - the exact shape `piece-parts.ts`'s own `decompose` would
  // give the "h" part, matching the STORED escrow exactly (content-store-patch.ts's own equality check,
  // fixed 2026-10-01). A head is also free to omit `original` entirely - `ContentStore.patch` then
  // keeps the cached escrow untouched, never wiped - but this fixture always sends the placeholder
  // form anyway, to exercise that equality check on every op, not only the escrow-specific ones.
  const head = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id: "p1",
    body: { name: nextState.headName, prompts: [] },
    original: { testfmt: { raw: null, unmapped: {} }, sidecar: { raw: null } },
  };
  const patch: PiecePatch = { head };
  switch (op.kind) {
    case "edit": {
      const names = computeNames(nextState.items);
      patch.items = { [names[op.index]!]: block(nextState.items[op.index]!.id, nextState.items[op.index]!.content) };
      return patch;
    }
    case "head":
      return patch;
    case "original":
      patch.original = { sidecar: { big: nextState.sidecarRaw } };
      return patch;
    case "add": {
      const names = computeNames(nextState.items);
      patch.order = names;
      patch.items = { ...renamedSurvivors(state, nextState), [names[op.index]!]: block(op.id, op.content) };
      return patch;
    }
    case "remove": {
      patch.order = computeNames(nextState.items);
      const items = renamedSurvivors(state, nextState);
      if (Object.keys(items).length > 0) patch.items = items;
      return patch;
    }
    case "reorder": {
      patch.order = computeNames(nextState.items);
      const items = renamedSurvivors(state, nextState);
      if (Object.keys(items).length > 0) patch.items = items;
      return patch;
    }
  }
}

export function contentStorePatchContract(rig: () => Rig): void {
  describe("ContentStore.patch (S5/P3)", () => {
    test("differential: 200 seeded random patch sequences match a whole-entity save", async () => {
      for (let seed = 0; seed < 200; seed++) {
        const { store: patched, backend } = rig();
        const { store: whole } = rig();

        let state = initialState();
        const start = entityOf(state);
        expect((await patched.create(start)).status).toBe("saved");
        expect((await whole.create(start)).status).toBe("saved");
        let revision = (await patched.read("preset", "p1"))!.revision;
        // The escrow blob's leading BOM round-trips exactly (S4b's own fix, commit 1842d2b): `bigRaw`
        // is never touched by any op below, so this stays true for the rest of the sequence too.
        const readBack = (await patched.read("preset", "p1"))!.entity.original as Record<string, { raw: { big: string } }>;
        expect(readBack.testfmt!.raw.big.startsWith(BOM)).toBe(true);

        const rng = prng(seed);
        const steps = 1 + Math.floor(rng() * 4);
        for (let s = 0; s < steps; s++) {
          const op = pickOp(rng, state);
          const nextState = applyWhole(state, op);
          const patch = buildPatch(state, nextState, op);

          const patchResult = await patched.patch("preset", "p1", revision, patch);
          expect(patchResult.status).toBe("saved");
          await whole.save(entityOf(nextState), { overwrite: true });

          const patchedRead = await patched.read("preset", "p1");
          const wholeRead = await whole.read("preset", "p1");
          expect(patchedRead).not.toBeNull();
          expect(wholeRead).not.toBeNull();

          // 1. the patch's revision equals entityRevision(read()).
          expect(patchedRead!.revision).toBe(entityRevision(patchedRead!.entity));
          if (patchResult.status === "saved") expect(patchResult.summary.revision).toBe(patchedRead!.revision);
          // 2. the assembled bytes equal a whole-entity save of the same next entity.
          expect(JSON.stringify(patchedRead!.entity)).toBe(JSON.stringify(wholeRead!.entity));
          expect(patchedRead!.revision).toBe(wholeRead!.revision);
          // 3. the stamped summary equals buildSummary, read straight off the backend's own cell.
          const { rows: summaryRows } = await backend.summaries("preset");
          const stored = summaryRows.find((r) => r.id === "p1");
          expect(stored?.summary).toBe(buildSummary(patchedRead!.entity).text);

          state = nextState;
          revision = patchedRead!.revision;
        }
      }
    }, 60_000);

    test("stale: a patch built from a revision the piece has moved past is refused, nothing written", async () => {
      const { store } = rig();
      const state = initialState();
      await store.create(entityOf(state));
      const before = await store.read("preset", "p1");
      await store.save(entityOf(applyWhole(state, { kind: "head", newName: "moved on" })), { overwrite: true });

      const result = await store.patch("preset", "p1", before!.revision, buildPatch(state, state, { kind: "head", newName: "ignored" }));
      expect(result).toEqual({ status: "stale" });
      const after = await store.read("preset", "p1");
      expect(presetBodyOf(after!.entity).name).toBe("moved on"); // the refused patch changed nothing
    });

    test("missing: a patch against an id with no live row is refused", async () => {
      const { store } = rig();
      const result = await store.patch("preset", "ghost", "whatever-revision", { head: { kind: "preset", id: "ghost", body: { prompts: [] } } });
      expect(result).toEqual({ status: "missing" });
    });

    test("two patches racing from the same revision: exactly one wins, the other is told stale", async () => {
      const { store: storeA, backend } = rig();
      const storeB = createContentStore(backend, () => 2);
      const state = initialState();
      await storeA.create(entityOf(state));
      const revision = (await storeA.read("preset", "p1"))!.revision;

      const patchA = buildPatch(state, applyWhole(state, { kind: "head", newName: "from A" }), { kind: "head", newName: "from A" });
      const patchB = buildPatch(state, applyWhole(state, { kind: "head", newName: "from B" }), { kind: "head", newName: "from B" });

      const [resultA, resultB] = await Promise.all([storeA.patch("preset", "p1", revision, patchA), storeB.patch("preset", "p1", revision, patchB)]);
      const statuses = [resultA.status, resultB.status].sort();
      expect(statuses).toEqual(["saved", "stale"]);
    });

    test("a second store on the same database writes; the first store's next patch reloads and stays correct", async () => {
      const { store: storeA, backend } = rig();
      const storeB = createContentStore(backend, () => 2);
      const state = initialState();
      await storeA.create(entityOf(state));
      const revision = (await storeA.read("preset", "p1"))!.revision;

      // storeB writes a whole-entity change storeA's cache (still at the create's version) knows
      // nothing about.
      const afterB = applyWhole(state, { kind: "head", newName: "from B" });
      await storeB.save(entityOf(afterB), { overwrite: true });

      // storeA's own cached revision is now stale: a patch from its old revision is refused...
      const stalePatch = await storeA.patch("preset", "p1", revision, buildPatch(state, state, { kind: "head", newName: "ignored" }));
      expect(stalePatch).toEqual({ status: "stale" });

      // ...but storeA reloading (its cache's version no longer matches the live row) and patching
      // from the FRESH revision succeeds, and carries storeB's change forward rather than clobbering it.
      const fresh = (await storeA.read("preset", "p1"))!;
      expect(presetBodyOf(fresh.entity).name).toBe("from B");
      const afterA = applyWhole(afterB, { kind: "edit", index: 0, newContent: "from A, after B" });
      const patchFromA = buildPatch(afterB, afterA, { kind: "edit", index: 0, newContent: "from A, after B" });
      const result = await storeA.patch("preset", "p1", fresh.revision, patchFromA);
      expect(result.status).toBe("saved");
      const final = await storeA.read("preset", "p1");
      expect(presetBodyOf(final!.entity).name).toBe("from B"); // storeB's change survived
      expect(presetBodyOf(final!.entity).prompts[0]!.content).toBe("from A, after B"); // storeA's own change applied
    });

    test("a head-only patch right after a cold fill reuses every untouched escrow and item part - byte-correctness alone cannot prove this, only a real-build count can", async () => {
      // Regression, 2026-10-01: `buildNextOriginal` (content-store-patch.ts) used to forward the
      // cached ENTITY's own escrow value, which `assemble` always decodes separately from what
      // `coldFillParts` decoded for the "r/<fmt>" part - never the same object reference. `decompose`'s
      // `reuse` trusts identity alone, so every patch re-stringified and re-hashed the WHOLE escrow
      // regardless of whether it changed, paid right after every cold fill (a restart, a lock, an
      // eviction, a second store) - exactly the cost this path exists to avoid. The differential test
      // above cannot catch this: a missed reuse still produces byte-identical output, just slower.
      const { store } = rig();
      const state = initialState();
      await store.create(entityOf(state));
      const before = (await store.read("preset", "p1"))!;

      __resetPiecePartsStatsForTests();
      const op = { kind: "head" as const, newName: "renamed, nothing else touched" };
      const patch = buildPatch(state, applyWhole(state, op), op);
      const result = await store.patch("preset", "p1", before.revision, patch);
      expect(result.status).toBe("saved");

      // "h" and "o" are always rebuilt fresh by design (piece-parts.ts's own `decompose`, never passed
      // a `cached` to reuse); every item (4) and every escrow format (2, both over the split threshold)
      // must be REUSED, not rebuilt, so the total is exactly 2.
      expect(__piecePartsRealBuildsForTests()).toBe(2);
    });

    test("a head adding a top-level optional field the stored entity never had (notes) saves, not refused", async () => {
      // Guards the fix's OWN correctness, not only its performance: an earlier intermediate version of
      // the head's key-order fix walked the cached entity's own keys to decide what to keep, which
      // silently refused any field (`notes`, `profiles`) the STORED entity lacked but the head legitimately
      // added for the first time - caught only by hand, never by the differential (byte-correctness
      // alone cannot see a refusal that never happens on the "both already have original" fixtures
      // above). Red on that intermediate version, green on HEAD and on the final fix.
      const { store } = rig();
      const state = initialState();
      await store.create(entityOf(state)); // no `notes` at all
      const before = (await store.read("preset", "p1"))!;
      expect(Object.prototype.hasOwnProperty.call(before.entity, "notes")).toBe(false);

      const head = {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "preset",
        id: "p1",
        body: { name: state.headName, prompts: [] },
        original: { testfmt: { raw: null, unmapped: {} }, sidecar: { raw: null } },
        notes: [{ id: "n1", text: "a brand new note", at: "2026-10-01T00:00:00.000Z" }],
      };
      const result = await store.patch("preset", "p1", before.revision, { head });
      expect(result.status).toBe("saved");

      const after = (await store.read("preset", "p1"))!;
      expect(after.revision).toBe(entityRevision(after.entity));
      expect((after.entity as unknown as { notes: unknown }).notes).toEqual(head.notes);
    });

    describe("every refusal writes nothing", () => {
      async function setup(rigInner: () => Rig) {
        const { store } = rigInner();
        const state = initialState();
        await store.create(entityOf(state));
        const before = await store.read("preset", "p1");
        return { store, state, before: before! };
      }

      test("a patch that touches the vaud-studio stamp is refused", async () => {
        const { store, state, before } = await setup(rig);
        const patch = buildPatch(state, state, { kind: "original", newSidecar: state.sidecarRaw });
        patch.original = { "vaud-studio": { unmapped: { hijacked: true } } };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });

      test("an order naming an unknown item is refused", async () => {
        const { store, state, before } = await setup(rig);
        const patch: PiecePatch = {
          head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "p1", body: { name: state.headName, prompts: [] } },
          order: ["i/does-not-exist", ...computeNames(state.items).slice(1)],
        };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });

      test("a duplicate name in order is refused", async () => {
        const { store, state, before } = await setup(rig);
        const names = computeNames(state.items);
        const patch: PiecePatch = {
          head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "p1", body: { name: state.headName, prompts: [] } },
          order: [names[0]!, names[0]!, ...names.slice(2)],
        };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });

      test("an id change with no matching order update is refused: the recomputed names do not match", async () => {
        const { store, state, before } = await setup(rig);
        const names = computeNames(state.items);
        const patch: PiecePatch = {
          head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "p1", body: { name: state.headName, prompts: [] } },
          items: { [names[1]!]: block("renamed-b", state.items[1]!.content) },
          // order is omitted (defaults to the cached order), which no longer matches what the
          // renamed item's own id implies ("i/renamed-b", not "i/b").
        };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });

      test("an item that fails its schema is refused", async () => {
        const { store, state, before } = await setup(rig);
        const names = computeNames(state.items);
        const patch: PiecePatch = {
          head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "p1", body: { name: state.headName, prompts: [] } },
          items: { [names[0]!]: { id: "dup", name: "dup" /* missing every other required field */ } },
        };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });

      test("a head whose kind does not match the address is refused", async () => {
        const { store, state, before } = await setup(rig);
        const patch: PiecePatch = { head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "p1", body: { name: state.headName, entries: [] } } };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });

      test("a head carrying a non-empty item array is refused", async () => {
        const { store, state, before } = await setup(rig);
        const patch: PiecePatch = {
          head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "p1", body: { name: state.headName, prompts: [block("x", "x")] } },
        };
        await expect(store.patch("preset", "p1", before.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.read("preset", "p1"))!.revision).toBe(before.revision);
      });
    });
  });
}
