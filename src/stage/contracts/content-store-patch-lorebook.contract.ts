/**
 * The patch path contract's lorebook leg, beside `content-store-patch.contract.ts`'s preset
 * leg: a different `KindParts` registration (`entries`, not `prompts`), a different item schema, and a
 * body shape with extra fields (`categories`, `globalScanDepth`, ...) a preset's body does not have, so
 * a preset-only differential cannot by itself prove the patch path kind-agnostic. 200 seeds, same as
 * the preset leg - small, cheap sequences, never the 30 MB scale fixtures (`scripts/scale`'s own job).
 *
 * Also covers the escrow cases an independent review found in `buildNextOriginal`/`buildNextEntity`
 * (content-store-patch.ts, 2026-10-01): a patch head omitting `original` must not wipe the escrow, a
 * head editing `original["vaud-studio"]` directly must be refused exactly like the documented
 * `patch.original` refusal, and `patch.original` on an UNSPLIT (<=16 KB) format must actually apply.
 */
import { describe, expect, test } from "bun:test";
import { mulberry32 as prng } from "../../core/lore/rng";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { entityRevision } from "../../entities/canonical-revision";
import { StudioValidationError } from "../../studio/errors";
import { buildSummary } from "../store/summary-content";
import type { PiecePatch } from "./content-store";
import type { Rig } from "./content-store.contract-fixtures";

interface Item {
  key: number;
  id: string;
  content: string;
}
interface State {
  items: Item[];
  headName: string;
  sidecarRaw: string;
}

let nextKey = 0;
const freshItem = (id: string, content: string): Item => ({ key: nextKey++, id, content });

/** A lorebook entry with every field the current schema requires (`lorebook/runtime-schema.ts`'s
 * `entryShape`); everything beyond this is `.optional()`, so this is a valid, minimal, authored entry. */
function entry(id: string, content: string) {
  return {
    id,
    title: id,
    content,
    comment: null,
    enabled: true,
    constant: false,
    triggerMode: "simple" as const,
    triggers: [{ keyword: id, isRegex: false }],
    secondaryTriggers: [],
    selectiveLogic: "and_any" as const,
    caseSensitive: null,
    matchWholeWords: null,
    scanDepth: null,
    position: "world" as const,
    depth: 0,
    role: "system" as const,
    sortOrder: 0,
    priority: 0,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    groupName: null,
    categoryId: null,
    groupWeight: 1,
    probability: 100,
    useMemo: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: 0,
    characterFilter: null,
    scanCharacterDescription: true,
    scanCharacterPersonality: true,
    scanUserPersona: true,
    scanScenario: true,
    ignoreBudget: false,
    sideEffects: null,
  };
}

const emptyBody = (name: string) => ({
  name,
  tags: [] as string[],
  globalCaseSensitive: false,
  globalMatchWholeWords: false,
  globalScanDepth: 0,
  globalRecursion: false,
  tokenBudget: 0,
  budgetMode: "token" as const,
  entryBudget: 0,
});

function computeNames(items: readonly Item[]): string[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const n = (seen.get(it.id) ?? 0) + 1;
    seen.set(it.id, n);
    return n === 1 ? `i/${it.id}` : `i/${it.id}#${n}`;
  });
}

function initialState(): State {
  nextKey = 0;
  return {
    items: [freshItem("dup", "first"), freshItem("b", "B"), freshItem("dup", "second"), freshItem("c", "C")],
    headName: "Scale Lorebook",
    sidecarRaw: "sidecar escrow payload one ".repeat(700), // > 16 KB
  };
}

function entityOf(state: State): unknown {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "lb1",
    body: { ...emptyBody(state.headName), entries: state.items.map((it) => entry(it.id, it.content)) },
    original: { sidecar: { raw: { big: state.sidecarRaw } } },
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
      return { kind, newName: `Scale Lorebook ${Math.floor(rng() * 1e9)}` };
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

/** Every surviving item whose part NAME changed (an occurrence-suffix shift, not only a remove's
 * "rename the second of a duplicate pair") - the cache's "unchanged items reused by reference" lookup
 * is BY NAME, so a renamed-but-unedited item must be resent under its new name. */
function renamedSurvivors(state: State, nextState: State): Record<string, unknown> {
  const oldNameByKey = new Map(state.items.map((it, i) => [it.key, computeNames(state.items)[i]!]));
  const newNames = computeNames(nextState.items);
  const items: Record<string, unknown> = {};
  nextState.items.forEach((it, i) => {
    const oldName = oldNameByKey.get(it.key);
    const newName = newNames[i]!;
    if (oldName !== undefined && oldName !== newName) items[newName] = entry(it.id, it.content);
  });
  return items;
}

/** The exact `PiecePatch` a correct client would send for `op`, derived from `state`'s own names
 * rather than anything the store caches - a true black-box client. */
function buildPatch(state: State, nextState: State, op: Op): PiecePatch {
  const head = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "lb1", body: { ...emptyBody(nextState.headName), entries: [] } };
  const patch: PiecePatch = { head };
  switch (op.kind) {
    case "edit": {
      const names = computeNames(nextState.items);
      patch.items = { [names[op.index]!]: entry(nextState.items[op.index]!.id, nextState.items[op.index]!.content) };
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
      patch.items = { ...renamedSurvivors(state, nextState), [names[op.index]!]: entry(op.id, op.content) };
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

/** A lorebook with a small (unsplit, <=16 KB) escrow format AND the Studio stamp, for the three escrow
 * cases below - never the `sidecar`/differential fixture above, which is deliberately always over the
 * 16 KB split threshold. */
const lorebookWithSmallEscrow = () => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "lorebook",
  id: "lb2",
  body: { ...emptyBody("Small Book"), entries: [] },
  original: {
    "vaud-studio": { raw: null, unmapped: { tag: "do-not-touch" } },
    smallfmt: { raw: { tiny: "original-value" }, unmapped: {} },
  },
});

export function contentStorePatchLorebookContract(rig: () => Rig): void {
  describe("ContentStore.patch (S5/P3): lorebook leg", () => {
    test("differential: 200 seeded random patch sequences match a whole-entity save (lorebook body shape)", async () => {
      for (let seed = 0; seed < 200; seed++) {
        const { store: patched, backend } = rig();
        const { store: whole } = rig();

        let state = initialState();
        const start = entityOf(state);
        expect((await patched.create(start)).status).toBe("saved");
        expect((await whole.create(start)).status).toBe("saved");
        let revision = (await patched.read("lorebook", "lb1"))!.revision;

        const rng = prng(seed);
        const steps = 1 + Math.floor(rng() * 4);
        for (let s = 0; s < steps; s++) {
          const op = pickOp(rng, state);
          const nextState = applyWhole(state, op);
          const patch = buildPatch(state, nextState, op);

          const patchResult = await patched.patch("lorebook", "lb1", revision, patch);
          expect(patchResult.status).toBe("saved");
          await whole.save(entityOf(nextState), { overwrite: true });

          const patchedRead = await patched.read("lorebook", "lb1");
          const wholeRead = await whole.read("lorebook", "lb1");
          expect(patchedRead).not.toBeNull();
          expect(wholeRead).not.toBeNull();

          expect(patchedRead!.revision).toBe(entityRevision(patchedRead!.entity));
          if (patchResult.status === "saved") expect(patchResult.summary.revision).toBe(patchedRead!.revision);
          expect(JSON.stringify(patchedRead!.entity)).toBe(JSON.stringify(wholeRead!.entity));
          expect(patchedRead!.revision).toBe(wholeRead!.revision);

          const { rows: summaryRows } = await backend.summaries("lorebook");
          const stored = summaryRows.find((r) => r.id === "lb1");
          expect(stored?.summary).toBe(buildSummary(patchedRead!.entity).text);

          state = nextState;
          revision = patchedRead!.revision;
        }
      }
    }, 60_000);

    test("(a) a patch head with no `original` key does not wipe the escrow, the Studio stamp included", async () => {
      const { store } = rig();
      await store.create(lorebookWithSmallEscrow());
      const before = await store.read("lorebook", "lb2");

      const patch: PiecePatch = { head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "lb2", body: { ...emptyBody("Small Book renamed"), entries: [] } } };
      const result = await store.patch("lorebook", "lb2", before!.revision, patch);
      expect(result.status).toBe("saved");

      const after = await store.read("lorebook", "lb2");
      expect(after!.entity.original).toEqual(before!.entity.original);
    });

    test("(b) a patch head that edits original['vaud-studio'] directly is refused, nothing written", async () => {
      const { store } = rig();
      await store.create(lorebookWithSmallEscrow());
      const before = await store.read("lorebook", "lb2");

      const patch: PiecePatch = {
        head: {
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "lorebook",
          id: "lb2",
          body: { ...emptyBody("Small Book"), entries: [] },
          // Changed via the HEAD, not patch.original - the bypass the documented `patch.original`-only
          // refusal (above, "vaud-studio") never saw.
          original: { "vaud-studio": { raw: null, unmapped: { tag: "HIJACKED" } }, smallfmt: { raw: { tiny: "original-value" }, unmapped: {} } },
        },
      };
      await expect(store.patch("lorebook", "lb2", before!.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);

      const after = await store.read("lorebook", "lb2");
      expect(after!.revision).toBe(before!.revision);
      expect(after!.entity.original).toEqual(before!.entity.original);
    });

    test("(c) patch.original on an UNSPLIT (<=16 KB) escrow format is applied, never silently dropped", async () => {
      const { store } = rig();
      await store.create(lorebookWithSmallEscrow());
      const before = await store.read("lorebook", "lb2");

      const patch: PiecePatch = {
        head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "lb2", body: { ...emptyBody("Small Book"), entries: [] } },
        original: { smallfmt: { tiny: "CHANGED-value" } },
      };
      const result = await store.patch("lorebook", "lb2", before!.revision, patch);
      expect(result.status).toBe("saved");

      const after = await store.read("lorebook", "lb2");
      const raw = (after!.entity.original as Record<string, { raw: unknown }>).smallfmt!.raw;
      expect(raw).toEqual({ tiny: "CHANGED-value" });
    });

    test("(d) patch.original naming a format the stored escrow does not have is refused, nothing written", async () => {
      const { store } = rig();
      await store.create(lorebookWithSmallEscrow());
      const before = await store.read("lorebook", "lb2");

      const patch: PiecePatch = {
        head: { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "lb2", body: { ...emptyBody("Small Book"), entries: [] } },
        original: { "nonexistent-format": { anything: true } },
      };
      await expect(store.patch("lorebook", "lb2", before!.revision, patch)).rejects.toBeInstanceOf(StudioValidationError);

      const after = await store.read("lorebook", "lb2");
      expect(after!.revision).toBe(before!.revision);
      expect(after!.entity.original).toEqual(before!.entity.original);
    });
  });
}
