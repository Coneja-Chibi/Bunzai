/**
 * The ContentStore concurrency contract: whichever caller wins a race,
 * the loser never corrupts the winner. Run by content-store.contract.ts for every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioNotFoundError } from "../../studio/errors";
import { createContentStore } from "../store/content-store";
import type { ContentSummary, DocumentBackend } from "./content-store";
import { character, type Rig } from "./content-store.contract-fixtures";

/**
 * A backend view that runs `action` once, around the first call made through it. `after` is the
 * moment a store operation has read something and not yet acted on it; `before` lets the second
 * caller win outright. A Proxy passes every method through, so the tests hold for any backend.
 *
 * THE LIMIT: this can only slip in BETWEEN backend calls, never inside one. A backend method that is
 * internally non-atomic (a SELECT, then a separate DELETE) is invisible here, so every real backend
 * proves its own methods are single transactions in its own tests.
 */
function interleaveFirstCall(
  inner: DocumentBackend,
  timing: "before" | "after",
  action: () => Promise<unknown>,
): DocumentBackend {
  let fired = false;
  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        const runAction = async (): Promise<void> => {
          if (fired) return;
          fired = true;
          await action();
        };
        if (timing === "before") await runAction();
        const result: unknown = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        if (timing === "after") await runAction();
        return result;
      };
    },
  });
}

export function contentStoreConcurrencyContract(rig: () => Rig): void {
    describe("concurrency: whichever caller wins, the loser never corrupts the winner", () => {
      test("c1. purge never erases an entity that a racing restore brought back", async () => {
        const { store, backend, setNow } = rig();
        await store.save(character("vera"));
        setNow(100);
        await store.delete("character", "vera");
        setNow(1_000);
        const outcome: { restored: ContentSummary | null } = { restored: null };
        // "before": the restore wins outright, so purge meets a live row it must leave alone.
        // The opposite order, restore losing to purge, is c5.
        const [grave] = await store.graveyard();
        const racing = createContentStore(
          interleaveFirstCall(backend, "before", async () => {
            outcome.restored = await store.restore(grave!.graveId);
          }),
          () => 1_000,
        );
        await racing.purge(200);
        const alive = await store.read("character", "vera");
        expect(outcome.restored).not.toBeNull();
        expect(alive).not.toBeNull();
        expect((await store.versions("character", "vera")).versions).toHaveLength(1);
      });

      test("c5. a restore that loses to a purge reports nothing, not a phantom success", async () => {
        const { store, backend, setNow } = rig();
        await store.save(character("vera"));
        setNow(100);
        await store.delete("character", "vera");
        const [grave] = await store.graveyard();
        const racing = createContentStore(
          interleaveFirstCall(backend, "after", () => store.purge(200)),
          () => 1_000,
        );
        const restored = await racing.restore(grave!.graveId);
        const alive = await store.read("character", "vera");
        if (restored) expect(alive).not.toBeNull();
        else expect(alive).toBeNull();
      });

      test("c2. an overwrite racing a delete is refused as not found and never touches the grave", async () => {
        const { store, backend } = rig();
        await store.save(character("vera"));
        const outcome = { deleted: false };
        const racing = createContentStore(
          interleaveFirstCall(backend, "after", async () => {
            outcome.deleted = await store.delete("character", "vera");
          }),
          () => 2_000,
        );
        await expect(racing.save(character("vera", "Edit"), { overwrite: true })).rejects.toBeInstanceOf(StudioNotFoundError);
        expect(outcome.deleted).toBe(true);
        expect(await store.list()).toEqual([]);
        expect((await store.graveyard()).map((g) => g.name)).toEqual(["vera"]);
      });

      test("c3. saveIfUnchanged racing a delete never saves onto the grave", async () => {
        const { store, backend } = rig();
        await store.save(character("vera"));
        const base = await store.read("character", "vera");
        const racing = createContentStore(
          interleaveFirstCall(backend, "after", () => store.delete("character", "vera")),
          () => 2_000,
        );
        const result = await racing.saveIfUnchanged(character("vera", "Edit"), base!.revision);
        expect(result.status).not.toBe("saved");
        expect(await store.read("character", "vera")).toBeNull();
      });

      test("c4. a writer that read an old revision can never claim a version number twice", async () => {
        const { store, backend } = rig();
        await store.save(character("vera", "One"));
        const base = await store.read("character", "vera");
        const racing = createContentStore(
          interleaveFirstCall(backend, "after", async () => {
            await store.save(character("vera", "Two"), { overwrite: true });
            await store.restoreVersion("character", "vera", 1); // the body is back to revision one
          }),
          () => 2_000,
        );
        const result = await racing.saveIfUnchanged(character("vera", "Late edit"), base!.revision);
        const numbers = (await store.versions("character", "vera")).versions.map((v) => v.version);
        expect(numbers).toEqual(numbers.map((_, i) => i + 1)); // 1..n, no repeats, no gaps
        expect((await store.read("character", "vera"))?.version).toBe(numbers.length);
        if (result.status === "saved") expect(result.summary.version).toBe(numbers.length);
      });
    });
}
