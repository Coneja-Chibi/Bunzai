/** Equivalence tests for lorebook body operations shared by every editor surface. */
import { describe, expect, test } from "bun:test";
import { emptyLorebookBody } from "../../../core/lore";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import type { CanonicalLorebook } from "../schema";
import capabilities from "./entries";
import {
  removeLorebookEntries,
  reorderLorebookEntry,
  setLorebookEntriesEnabled,
  updateLorebookEntry,
  updateLorebookSettings,
} from "./operations";

describe("lorebook capability operations", () => {
  test("updates settings without replacing entries or unrelated fields", () => {
    const body = emptyLorebookBody("World");
    const next = updateLorebookSettings(body, { name: "Aetheria", tokenBudget: 900 });

    expect(next.name).toBe("Aetheria");
    expect(next.tokenBudget).toBe(900);
    expect(next.entries).toBe(body.entries);
    expect(body.name).toBe("World");
  });

  test("updates one entry while preserving its id", () => {
    const body = emptyLorebookBody("World");
    const id = body.entries[0]!.id;
    const next = updateLorebookEntry(body, id, {
      id: "replacement-is-forbidden",
      title: "Dragon",
      content: "A large reptile",
    });

    expect(next.entries[0]).toMatchObject({ id, title: "Dragon", content: "A large reptile" });
    expect(body.entries[0]!.title).not.toBe("Dragon");
  });

  test("unknown requested entry ids throw", () => {
    const body = emptyLorebookBody("World");
    expect(() => updateLorebookEntry(body, "missing", { title: "Nope" }))
      .toThrow('lorebook entry "missing" does not exist');
    expect(() => reorderLorebookEntry(body, "missing", 0))
      .toThrow('lorebook entry "missing" does not exist');
  });

  test("bulk operations reject any missing requested entry id", () => {
    const body = emptyLorebookBody("World");
    const id = body.entries[0]!.id;
    expect(() => setLorebookEntriesEnabled(body, [id, "missing"], false))
      .toThrow('lorebook entry "missing" does not exist');
    expect(() => removeLorebookEntries(body, [id, "missing"]))
      .toThrow('lorebook entry "missing" does not exist');
  });

  test("reorders, enables, and removes selected entries without touching survivors", () => {
    const body = emptyLorebookBody("World");
    const first = body.entries[0]!;
    const second = { ...structuredClone(first), id: "second", title: "Second" };
    const third = { ...structuredClone(first), id: "third", title: "Third" };
    const expanded = { ...body, entries: [first, second, third] };

    const reordered = reorderLorebookEntry(expanded, "third", 0);
    expect(reordered.entries.map((entry) => entry.id)).toEqual(["third", first.id, "second"]);

    const disabled = setLorebookEntriesEnabled(reordered, [first.id, "third"], false);
    expect(disabled.entries.filter((entry) => !entry.enabled).map((entry) => entry.id))
      .toEqual(["third", first.id]);

    const removed = removeLorebookEntries(disabled, [first.id]);
    expect(removed.entries.map((entry) => entry.id)).toEqual(["third", "second"]);
    expect(removed.entries[1]).toBe(disabled.entries[2]);
  });

  test("empty bulk selections keep referential identity", () => {
    const body = emptyLorebookBody("World");
    expect(setLorebookEntriesEnabled(body, [], false)).toBe(body);
    expect(removeLorebookEntries(body, [])).toBe(body);
  });
});

test("public lorebook capability previews reject every requested missing entry id", () => {
  const entity: CanonicalLorebook = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "world",
    body: { ...emptyLorebookBody("World"), entries: [] },
  };
  const preview = (id: string, value: unknown) =>
    capabilities.find((capability) => capability.id === id)!.preview(entity, value as never);
  expect(() => preview("lorebook.entries.update", {
    target: { id: "world" }, entryId: "missing", patch: { title: "x" },
  })).toThrow('lorebook entry "missing" does not exist');
  expect(() => preview("lorebook.entries.reorder", {
    target: { id: "world" }, entryId: "missing", toIndex: 0,
  })).toThrow('lorebook entry "missing" does not exist');
  expect(() => preview("lorebook.entries.enable", {
    target: { id: "world" }, entryIds: ["missing"], enabled: true,
  })).toThrow('lorebook entry "missing" does not exist');
  expect(() => preview("lorebook.entries.remove", {
    target: { id: "world" }, entryIds: ["missing"],
  })).toThrow('lorebook entry "missing" does not exist');
});
