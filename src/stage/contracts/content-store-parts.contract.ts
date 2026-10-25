/**
 * Appendix A P2's own contract: a one-block edit
 * writes exactly one part and drops none, an untouched escrow seals no `r/` part, prune keeps every
 * surviving version byte-identical, and purge/bury/unbury round-trip exactly. Run by
 * content-store.contract.ts for every backend; split out for the line cap.
 */
import { describe, expect, test } from "bun:test";
import { createContentStore } from "../store/content-store";
import type { DocumentBackend, PartChange } from "./content-store";
import { presetWithEscrow, type Rig } from "./content-store.contract-fixtures";

/** Every `write()` call's `change`, captured through a backend wrapper - works for any backend, the
 * same way content-store-concurrency.contract.ts's interleaving wrapper does. */
function captureChanges(inner: DocumentBackend): { changes: PartChange[]; backend: DocumentBackend } {
  const changes: PartChange[] = [];
  return {
    changes,
    backend: {
      ...inner,
      async write(row, version, condition, summary, change) {
        changes.push(change);
        return inner.write(row, version, condition, summary, change);
      },
    },
  };
}

export function contentStorePartsContract(rig: () => Rig, makeBackend: () => DocumentBackend): void {
  describe("Appendix A P2: parts in storage (S4a)", () => {
    test("a one-block edit writes exactly one part and drops none", async () => {
      const { changes, backend } = captureChanges(makeBackend());
      const store = createContentStore(backend, () => 1);
      await store.save(presetWithEscrow("p"));
      changes.length = 0; // only the edit below is measured
      await store.save(presetWithEscrow("p", "changed"), { overwrite: true });
      expect(changes).toHaveLength(1);
      const change = changes[0]!;
      if ("restore" in change) throw new Error("expected a put/drop change");
      expect(change.put.map((p) => p.name)).toEqual(["i/a"]);
      expect(change.drop).toEqual([]);
    });

    test("an edit that leaves the escrow alone writes no r/ part", async () => {
      const { changes, backend } = captureChanges(makeBackend());
      const store = createContentStore(backend, () => 1);
      await store.save(presetWithEscrow("p"));
      changes.length = 0;
      await store.save(presetWithEscrow("p", "changed again"), { overwrite: true });
      const change = changes[0]!;
      if ("restore" in change) throw new Error("expected a put/drop change");
      expect(change.put.some((p) => p.name.startsWith("r/"))).toBe(false);
      expect(change.drop.some((n) => n.startsWith("r/"))).toBe(false);
    });

    test("prune keeps every surviving version byte-identical", async () => {
      const { store } = rig();
      await store.save(presetWithEscrow("p", "v0"));
      for (let n = 1; n <= 30; n++) await store.save(presetWithEscrow("p", `v${n}`), { overwrite: true });
      const kept = (await store.versions("preset", "p")).versions;
      expect(kept).toHaveLength(25); // default retention
      for (const v of kept) {
        const read = await store.readVersion("preset", "p", v.version);
        expect(read).not.toBeNull();
        // Version 1 is "v0" (the initial save); version N is "v(N-1)" (the Nth overwrite). Block "b"
        // and the escrow never change, so only block "a"'s own content is asserted here.
        const body = read!.body as { prompts: { id: string; content: string }[] };
        expect(body.prompts.find((p) => p.id === "a")?.content).toBe(`v${v.version - 1}`);
        expect(body.prompts.find((p) => p.id === "b")?.content).toBe("second");
      }
    });

    test("purge leaves nothing readable under the purged key", async () => {
      const { store, setNow } = rig();
      await store.save(presetWithEscrow("p"));
      setNow(100);
      await store.delete("preset", "p");
      expect(await store.purge(200)).toBe(1);
      expect(await store.readVersion("preset", "p", 1)).toBeNull();
    });

    test("bury and unbury round-trip the entity byte-identically", async () => {
      const { store } = rig();
      const saved = await store.save(presetWithEscrow("p"));
      const before = await store.read("preset", "p");
      await store.delete("preset", "p");
      const [grave] = await store.graveyard();
      const restored = await store.restore(grave!.graveId);
      expect(restored).toMatchObject({ id: "p", version: saved.version });
      const after = await store.read("preset", "p");
      expect(after?.entity).toEqual(before!.entity);
    });
  });
}
