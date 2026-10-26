/** The Nodes view's one write: what is sent, what is refused, and what a conflict says. */
import { expect, test } from "bun:test";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import { emptyPresetBody } from "../../../../entities/preset/schema";
import { writeLink } from "./link-write";

const character = (refs?: string[]) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "c1",
  body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, ...(refs ? { knowledgeRefs: refs } : {}) },
});
const vera: StudioEntitySummary = { kind: "character", id: "c1", name: "Vera" };
const book = { id: "b1", kind: "lorebook" };
type Sent = { head: { body: Record<string, unknown> } };

function harness(opts: { entity?: unknown; dirty?: boolean; patchError?: Error } = {}) {
  const calls: { read: string[]; patch: unknown[][]; status: string[] } = { read: [], patch: [], status: [] };
  const ctx = {
    api: {
      getEditableEntity: async (a: string) => { calls.read.push(a); return { entity: opts.entity ?? character(), revision: "r1" }; },
      getLightEditableEntity: async (a: string) => { calls.read.push(a); return { entity: opts.entity, revision: "r1", version: 1, assets: {} }; },
      patchEditedEntity: async (...args: unknown[]) => { calls.patch.push(args); if (opts.patchError) throw opts.patchError; return { revision: "r2" }; },
    },
    setStatus: (s: string) => calls.status.push(s),
    workbench: { dirty: () => (opts.dirty ? { "character:c1": true } : {}) },
  } as unknown as AppContext;
  return { ctx, calls };
}

test("linking a character to a lorebook patches knowledgeRefs and nothing else", async () => {
  const { ctx, calls } = harness();
  expect(await writeLink(ctx, vera, "knowledgeRefs", book, true)).toBe("saved");
  expect(calls.patch).toHaveLength(1);
  const [kind, id, revision, patch] = calls.patch[0]!;
  expect([kind, id, revision]).toEqual(["character", "c1", "r1"]);
  const sent = (patch as Sent).head.body;
  expect(sent.knowledgeRefs).toEqual(["b1"]);
  expect(Object.keys(sent).sort()).toEqual(["attribution", "discovery", "examples", "greetings", "identity", "knowledgeRefs", "media", "persona", "prompts"]);
  expect(Object.keys(patch as object)).toEqual(["head"]);
});

test("unlinking removes only that id, and the field once it is empty", async () => {
  const kept = harness({ entity: character(["b1", "b2"]) });
  await writeLink(kept.ctx, vera, "knowledgeRefs", book, false);
  expect((kept.calls.patch[0]![3] as Sent).head.body.knowledgeRefs).toEqual(["b2"]);
  const emptied = harness({ entity: character(["b1"]) });
  await writeLink(emptied.ctx, vera, "knowledgeRefs", book, false);
  expect("knowledgeRefs" in (emptied.calls.patch[0]![3] as Sent).head.body).toBe(false);
});

test("a link that already exists, or a pair the table does not allow, writes nothing", async () => {
  const have = harness({ entity: character(["b1"]) });
  expect(await writeLink(have.ctx, vera, "knowledgeRefs", book, true)).toBe("unchanged");
  const bad = harness();
  expect(await writeLink(bad.ctx, vera, "knowledgeRefs", { id: "r1", kind: "regex" }, true)).toBe("failed");
  expect(have.calls.patch.length + bad.calls.patch.length + bad.calls.read.length).toBe(0);
});

test("a piece with unsaved Desk edits is never read or written", async () => {
  const { ctx, calls } = harness({ dirty: true });
  expect(await writeLink(ctx, vera, "knowledgeRefs", book, true)).toBe("busy");
  expect(calls.read).toHaveLength(0);
  expect(calls.patch).toHaveLength(0);
  expect(calls.status).toEqual(["Save or discard Vera's edits first"]);
});

test("a revision conflict says so and does not retry", async () => {
  const { ctx, calls } = harness({ patchError: new ApiHttpError(409, "stale") });
  expect(await writeLink(ctx, vera, "knowledgeRefs", book, true)).toBe("conflict");
  expect(calls.patch).toHaveLength(1);
  expect(calls.status[0]).toContain("changed somewhere else first");
});

test("a preset links regex sets through behaviorRefs, read light", async () => {
  const entity = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "s1", body: emptyPresetBody("Cut") };
  const { ctx, calls } = harness({ entity });
  const preset: StudioEntitySummary = { kind: "preset", id: "s1", name: "Cut" };
  expect(await writeLink(ctx, preset, "behaviorRefs", { id: "r1", kind: "regex" }, true)).toBe("saved");
  expect(calls.read[0]).toBe("kind=preset&id=s1");
  expect((calls.patch[0]![3] as { head: { body: { behaviorRefs: string[] } } }).head.body.behaviorRefs).toEqual(["r1"]);
});
