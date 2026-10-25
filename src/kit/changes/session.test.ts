/** Draft composition and canonical-invariant coverage for Kit change sessions. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLorebookBody } from "../../core/lore";
import type { CanonicalLorebook } from "../../entities/lorebook/schema";
import type { ContentCapability } from "../../entities/capabilities";
import { z } from "zod";
import { discoverCapabilities } from "../capabilities/discover";
import { createChangeSession } from "./session";

const entity = (): CanonicalLorebook => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "lorebook",
  id: "world",
  body: emptyLorebookBody("World"),
  original: {
    sillytavern: {
      raw: { entries: { "0": { content: "source twin" } } },
      unmapped: { privateField: "sealed" },
    },
  },
});

describe("ChangeSession", () => {
  describe("a draft exists only while it changes something", () => {
    const op = { capabilityId: "test.edit", input: {}, changes: [], warnings: [], platformImpact: [] };

    test("a capability edit that changes nothing makes no draft", async () => {
      const settings = (await discoverCapabilities()).find((c) => c.id === "lorebook.settings.update")!;
      const changes = createChangeSession();
      expect(changes.draft(settings, { target: { id: "world" }, patch: { name: "World" } }, entity())).toBeNull();
      expect(changes.forTarget("lorebook", "world")).toBeNull();
      expect(changes.list()).toEqual([]);
    });

    test("an edit that brings a pending draft back to the original drops the draft", async () => {
      const settings = (await discoverCapabilities()).find((c) => c.id === "lorebook.settings.update")!;
      const changes = createChangeSession();
      const first = changes.draft(settings, { target: { id: "world" }, patch: { name: "Aetheria" } }, entity())!;
      expect(changes.draft(settings, { target: { id: "world" }, patch: { name: "World" } }, entity())).toBeNull();
      expect(changes.get(first.id)?.status).toBe("discarded");
      expect(changes.forTarget("lorebook", "world")).toBeNull();
    });

    test("a direct revision that changes nothing makes no draft", () => {
      const changes = createChangeSession();
      expect(changes.revise(entity(), structuredClone(entity()), op)).toBeNull();
      expect(changes.list()).toEqual([]);
    });

    test("escrow equality ignores object key order", () => {
      const original = entity();
      const reordered = structuredClone(original);
      reordered.original = {
        sillytavern: {
          unmapped: { privateField: "sealed" },
          raw: { entries: { "0": { content: "source twin" } } },
        },
      };
      expect(createChangeSession().revise(original, reordered, op)).toBeNull();
    });

    test("amending a draft back to the original drops it", () => {
      const changes = createChangeSession();
      const original = entity();
      const renamed = { ...original, body: { ...original.body, name: "Aetheria" } };
      const draft = changes.revise(original, renamed, op)!;
      expect(changes.amend(draft.id, structuredClone(original))?.status).toBe("discarded");
      expect(changes.forTarget("lorebook", "world")).toBeNull();
    });
  });

  test("composes multiple semantic operations into one draft for one target", async () => {
    const catalog = await discoverCapabilities();
    const update = catalog.find((capability) => capability.id === "lorebook.entries.update")!;
    const settings = catalog.find((capability) => capability.id === "lorebook.settings.update")!;
    const original = entity();
    const entryId = original.body.entries[0]!.id;
    const changes = createChangeSession();

    const first = changes.draft(update, {
      target: { id: original.id },
      entryId,
      patch: { title: "Dragon" },
    }, original)!;
    const second = changes.draft(settings, {
      target: { id: original.id },
      patch: { name: "Aetheria" },
    }, original)!;

    expect(second.id).toBe(first.id);
    expect(second.operations).toHaveLength(2);
    expect((second.proposed.body as typeof original.body).name).toBe("Aetheria");
    expect((second.proposed.body as typeof original.body).entries[0]!.title).toBe("Dragon");
    expect((second.baseline.body as typeof original.body).name).toBe("World");
  });

  test("preserves escrow and rejects target identity changes", async () => {
    const [update] = (await discoverCapabilities())
      .filter((capability) => capability.id === "lorebook.entries.update");
    const original = entity();
    const changes = createChangeSession();
    const draft = changes.draft(update!, {
      target: { id: original.id },
      entryId: original.body.entries[0]!.id,
      patch: { content: "Changed canonical content" },
    }, original)!;

    expect(draft.proposed.original).toEqual(original.original);
    expect(() => changes.draft(update!, {
      target: { id: "other" },
      entryId: original.body.entries[0]!.id,
      patch: { title: "Nope" },
    }, original)).toThrow("target id");
  });

  test("discards a draft exactly once", async () => {
    const [update] = (await discoverCapabilities())
      .filter((capability) => capability.id === "lorebook.entries.update");
    const original = entity();
    const changes = createChangeSession();
    const draft = changes.draft(update!, {
      target: { id: original.id },
      entryId: original.body.entries[0]!.id,
      patch: { title: "Dragon" },
    }, original)!;

    expect(changes.discard(draft.id)?.status).toBe("discarded");
    expect(changes.discard(draft.id)).toBeNull();
    expect(changes.forTarget("lorebook", original.id)).toBeNull();
  });

  test("retains warnings and platform impact for every composed operation", () => {
    const original = entity();
    const changes = createChangeSession();
    const capability: ContentCapability<{ target: { id: string }; value: string }> = {
      id: "lorebook.entries.explain",
      kind: "lorebook",
      area: "entries",
      action: "explain",
      summary: "Exercise complete draft evidence.",
      aliases: [],
      platforms: "canonical",
      exposure: "deferred",
      effect: "draft",
      input: z.object({
        target: z.object({ id: z.string() }),
        value: z.string(),
      }),
      concurrencyKey: ({ target }) => `lorebook/${target.id}`,
      preview(source, input) {
        return {
          entity: { ...source, body: { ...(source.body as CanonicalLorebook["body"]), name: `World ${input.value}` } } as typeof source,
          changes: [{
            path: "body.name",
            label: input.value,
            before: "World",
            after: `World ${input.value}`,
          }],
          warnings: [`warning ${input.value}`],
          platformImpact: [{
            platform: "sillytavern",
            disposition: "carried",
            detail: `impact ${input.value}`,
          }],
        };
      },
    };

    changes.draft(capability, { target: { id: "world" }, value: "one" }, original);
    const draft = changes.draft(
      capability,
      { target: { id: "world" }, value: "two" },
      original,
    )!;

    expect(draft.operations.map((operation) => operation.platformImpact[0]?.detail))
      .toEqual(["impact one", "impact two"]);
    expect(draft.operations.map((operation) => operation.warnings[0]))
      .toEqual(["warning one", "warning two"]);
    expect(draft.platformImpact).toHaveLength(2);
    expect(changes.list().map((item) => item.id)).toEqual([draft.id]);
  });
});
