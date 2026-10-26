/** The Pipeline layer's writes: one preset patch per toggle or move, nothing over unsaved Desk edits. */
import { expect, test } from "bun:test";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { PresetPrompt } from "../../../../entities/preset";
import { emptyPresetBody } from "../../../../entities/preset/schema";
import { writePreset } from "./preset-write";

const block = (id: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id, name: id, content: `text of ${id}`, role: "system", enabled: true, systemPrompt: false, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...over,
});
const entity = (...prompts: PresetPrompt[]) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "s1", body: { ...emptyPresetBody("Cut"), prompts } });
const cut: StudioEntitySummary = { kind: "preset", id: "s1", name: "Cut" };
/** The patch carries only what changed: the changed blocks by name, and the order when it moved. */
type Sent = { items?: Record<string, PresetPrompt>; order?: string[] };

function harness(opts: { entity: unknown; dirty?: boolean; patchError?: Error }) {
  const calls: { read: string[]; patch: unknown[][]; status: string[] } = { read: [], patch: [], status: [] };
  const ctx = {
    api: {
      getLightEditableEntity: async (a: string) => { calls.read.push(a); return { entity: opts.entity, revision: "r1", version: 1, assets: {} }; },
      patchEditedEntity: async (...args: unknown[]) => { calls.patch.push(args); if (opts.patchError) throw opts.patchError; return { revision: "r2" }; },
    },
    setStatus: (s: string) => calls.status.push(s),
    workbench: { dirty: () => (opts.dirty ? { "preset:s1": true } : {}) },
  } as unknown as AppContext;
  return { ctx, calls };
}

test("switching a block off makes exactly one preset patch that changes that block and nothing else", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a"), block("b"), block("c")) });
  expect(await writePreset(ctx, cut, { t: "set", id: "b", enabled: false })).toBe("saved");
  expect(calls.patch).toHaveLength(1);
  const [kind, id, revision, patch] = calls.patch[0]!;
  expect([kind, id, revision]).toEqual(["preset", "s1", "r1"]);
  const sent = patch as Sent;
  expect(Object.keys(sent.items ?? {})).toEqual(["i/b"]);
  expect(sent.items!["i/b"]).toEqual(block("b", { enabled: false }));
  expect(sent.order).toBeUndefined();
});

test("moving a block onto another makes exactly one patch with the editor's own reorder", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a"), block("b"), block("c")) });
  expect(await writePreset(ctx, cut, { t: "move", from: "a", to: "c", seen: ["a", "b", "c"] })).toBe("saved");
  expect(calls.patch).toHaveLength(1);
  const sent = calls.patch[0]![3] as Sent;
  expect(sent.order).toEqual(["i/b", "i/c", "i/a"]);
  expect(sent.items).toBeUndefined();
});

test("a move that would not change the build order is refused with a sentence and writes nothing", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a"), block("b", { placement: "append_preset" })) });
  expect(await writePreset(ctx, cut, { t: "move", from: "a", to: "b", seen: ["a", "b"] })).toBe("unchanged");
  expect(calls.patch).toHaveLength(0);
  expect(calls.status[0]).toContain("would change nothing");
});

test("a preset with unsaved Desk edits is never read or written", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a")), dirty: true });
  expect(await writePreset(ctx, cut, { t: "set", id: "a", enabled: false })).toBe("busy");
  expect(await writePreset(ctx, cut, { t: "move", from: "a", to: "a", seen: ["a"] })).toBe("busy");
  expect(calls.read).toHaveLength(0);
  expect(calls.patch).toHaveLength(0);
  expect(calls.status).toEqual(["Save or discard Cut's edits first", "Save or discard Cut's edits first"]);
});

test("a block that is gone from the fresh read writes nothing and says so", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a")) });
  expect(await writePreset(ctx, cut, { t: "set", id: "ghost", enabled: false })).toBe("unchanged");
  expect(calls.patch).toHaveLength(0);
  expect(calls.status[0]).toContain("no longer in the preset");
});

test("a revision conflict says so and does not retry", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a")), patchError: new ApiHttpError(409, "stale") });
  expect(await writePreset(ctx, cut, { t: "set", id: "a", enabled: false })).toBe("conflict");
  expect(calls.patch).toHaveLength(1);
  expect(calls.status[0]).toContain("changed somewhere else first");
});

test("switching a block to the state it already has writes nothing (a second click after the first landed)", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a", { enabled: false })) });
  expect(await writePreset(ctx, cut, { t: "set", id: "a", enabled: false })).toBe("unchanged");
  expect(calls.patch).toHaveLength(0);
});

test("a move against an order that changed since it was drawn is refused and writes nothing", async () => {
  const { ctx, calls } = harness({ entity: entity(block("a"), block("b"), block("c")) });
  expect(await writePreset(ctx, cut, { t: "move", from: "a", to: "c", seen: ["b", "a", "c"] })).toBe("unchanged");
  expect(calls.patch).toHaveLength(0);
  expect(calls.status[0]).toContain("changed since they were drawn");
});
