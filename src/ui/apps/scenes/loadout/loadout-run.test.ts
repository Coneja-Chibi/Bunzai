/**
 * Applying a loadout (loadout-run.ts), against a stand-in api that logs every call: the fixed write order, a
 * receipt saved before the first write, a failure that stops the run and reports each row, and no receipt when
 * nothing would change.
 */
import { expect, test } from "bun:test";
import { UNDO_MS } from "../../../../core/loadout-panels";
import { fakeLoadoutApi } from "./fake-loadout-api";
import { runLoadout } from "./loadout-run";

const note = { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 } as const;
const loadout = {
  id: "l1", name: "Slow burn", panels: ["preset", "mainModel", "lorebooks", "stagecraftProps", "guides", "authorNote", "stageSettings"],
  values: { preset: { kind: "preset", id: "p", toggles: { a: true } }, mainModel: { id: "c", model: "m" }, lorebooks: { added: ["b"], off: [] }, stagecraftProps: { on: ["dice"] }, guides: ["g"], authorNote: note, stageSettings: { backdrop: { pack: "k", item: "i" } } },
};
const input = (fake: ReturnType<typeof fakeLoadoutApi>, over = {}) => ({ api: fake.api, chatId: "c1", loadout, now: 5_000, newCode: () => "LD-1", ...over });

test("the receipt is saved first, the units are written in the fixed order, and the rows are finished last", async () => {
  const fake = fakeLoadoutApi();
  const result = await runLoadout(input(fake));
  expect(fake.calls).toEqual(["receipt-save", "connection", "preset", "lore", "props", "guides", "note", "backdrop", "receipt-finish"]);
  expect(result.status).toBe("applied");
  expect(result.rows.map((r) => r.state)).toEqual(Array(7).fill("applied"));
  expect(result.receipt).toMatchObject({ code: "LD-1", chatId: "c1", loadoutId: "l1", loadoutName: "Slow burn" });
  expect(result.receipt!.rows.every((r) => r.state === "applied")).toBe(true);
  expect(fake.scene).toMatchObject({ connection: { id: "c", model: "m" }, lore: { added: ["b"], off: [] }, props: { on: ["dice"] }, prompting: { guides: ["g"], note }, backdrop: { pack: "k", item: "i" } });
});

test("Final Cut is written whole through its one setter, undoably (the receipt holds the value before)", async () => {
  const cut = { on: true as const, passes: [{ id: "post-editor", type: "editor" as const, order: 0, failureMode: "fallback" as const }] };
  const fake = fakeLoadoutApi({ persona: null, finalCut: { tools: { rewrite: { temperature: 0.5 } } } });
  const result = await runLoadout({ api: fake.api, chatId: "c1", loadout: { id: "l2", name: "Cut", panels: ["postProduction"], values: { postProduction: cut } }, now: 5_000, newCode: () => "LD-2" });
  expect(result.status).toBe("applied");
  expect(fake.calls).toEqual(["receipt-save", "finalCut", "receipt-finish"]);
  expect(fake.scene.finalCut).toEqual(cut);
  expect(fake.receipts.get("LD-2")!.before["finalCut"]).toEqual({ tools: { rewrite: { temperature: 0.5 } } });
});

test("the receipt holds, per unit, the value before and the value written, and the store's times", async () => {
  const fake = fakeLoadoutApi({ persona: null, connection: { id: "old", model: "o" } });
  const result = await runLoadout(input(fake));
  const receipt = fake.receipts.get("LD-1")!;
  expect(receipt.before["connection"]).toEqual({ id: "old", model: "o" });
  expect(receipt.after["connection"]).toEqual({ id: "c", model: "m" });
  expect(receipt.before["lore"]).toBeNull();
  expect(receipt.undoUntil - receipt.appliedAt).toBe(UNDO_MS);
  expect(result.receipt!.appliedAt).toBe(fake.clock.now);
});

test("what each setter answered comes back by unit, for the page to refresh from", async () => {
  const fake = fakeLoadoutApi();
  const result = await runLoadout(input(fake));
  expect(Object.keys(result.patch)).toEqual(["connection", "preset", "lore", "props", "guides", "note", "backdrop"]);
});

test("a failure part way stops the run: applied, failed and not attempted rows, later setters never called, nothing rolled back", async () => {
  const fake = fakeLoadoutApi();
  fake.failing.add("props");
  const result = await runLoadout(input(fake));
  expect(fake.calls).toEqual(["receipt-save", "connection", "preset", "lore", "props", "receipt-finish"]);
  expect(result.status).toBe("partial");
  expect(Object.fromEntries(result.rows.map((r) => [r.panel, r.state]))).toEqual({
    preset: "applied", mainModel: "applied", lorebooks: "applied", stagecraftProps: "failed", guides: "not-attempted", authorNote: "not-attempted", stageSettings: "not-attempted",
  });
  expect(result.rows.find((r) => r.panel === "stagecraftProps")!.why).toBe("props refused");
  expect(fake.scene.connection).toEqual({ id: "c", model: "m" });
  const saved = fake.receipts.get("LD-1")!;
  expect(saved.rows.map((r) => [r.unit, r.state])).toEqual([["connection", "applied"], ["preset", "applied"], ["lore", "applied"], ["props", "failed"], ["guides", "not-attempted"], ["note", "not-attempted"], ["backdrop", "not-attempted"]]);
  expect(saved.rows[3]!.error).toBe("props refused");
});

test("when the very first write fails the receipt still exists, every row says so, and the status is failed", async () => {
  const fake = fakeLoadoutApi();
  fake.failing.add("connection");
  const result = await runLoadout(input(fake));
  expect(result.status).toBe("failed");
  expect(Object.fromEntries(result.rows.map((r) => [r.panel, r.state]))).toEqual({ preset: "not-attempted", mainModel: "failed", lorebooks: "not-attempted", stagecraftProps: "not-attempted", guides: "not-attempted", authorNote: "not-attempted", stageSettings: "not-attempted" });
  expect(fake.receipts.has("LD-1")).toBe(true);
  expect(fake.calls).toEqual(["receipt-save", "connection", "receipt-finish"]);
});

test("if the receipt cannot be saved nothing is written at all", async () => {
  const fake = fakeLoadoutApi();
  fake.failing.add("receipt-save");
  const result = await runLoadout(input(fake));
  expect(result.status).toBe("not-saved");
  expect(result.error).toBe("Nothing was changed because the undo record could not be saved.");
  expect(fake.calls).toEqual(["receipt-save"]);
  expect(fake.scene).toEqual({ persona: null });
});

test("if the rows cannot be finished the apply stands, with a warning, and the receipt keeps its pending rows", async () => {
  const fake = fakeLoadoutApi();
  fake.failing.add("receipt-finish");
  const result = await runLoadout(input(fake));
  expect(result.status).toBe("applied");
  expect(result.warning).toBe("Applied. The undo record could not be updated; Undo may skip some rows.");
  expect(fake.receipts.get("LD-1")!.rows.every((r) => r.state === "pending")).toBe(true);
  expect(result.receipt!.rows.every((r) => r.state === "applied")).toBe(true);
});

test("a loadout that would change nothing writes nothing and leaves no receipt", async () => {
  const fake = fakeLoadoutApi({ persona: null, prompting: { guides: ["g"] } });
  const result = await runLoadout(input(fake, { loadout: { id: "l2", name: "Same", panels: ["guides", "persona", "dm"], values: { guides: ["g"], persona: "other", dm: 1 } } }));
  expect(result.status).toBe("nothing-to-change");
  expect(result.rows.map((r) => r.state)).toEqual(["unchanged", "kept-current", "unavailable"]);
  expect(fake.calls).toEqual([]);
  expect(fake.receipts.size).toBe(0);
});

test("a plan-time failure with nothing else to write is reported and writes nothing", async () => {
  const fake = fakeLoadoutApi();
  const result = await runLoadout(input(fake, { loadout: { id: "l3", name: "S", panels: ["samplers"], values: { samplers: { temperature: 1 } } } }));
  expect(result.status).toBe("nothing-to-change");
  expect(result.rows).toEqual([{ panel: "samplers", label: "Samplers", state: "failed", why: "Samplers need a preset on this scene. Pick a preset first." }]);
  expect(fake.calls).toEqual([]);
});

test("a plan-time failure beside real writes does not stop them, and the run is partial", async () => {
  const fake = fakeLoadoutApi();
  const result = await runLoadout(input(fake, { loadout: { id: "l4", name: "Mixed", panels: ["samplers", "guides"], values: { samplers: { temperature: 1 }, guides: ["g"] } } }));
  expect(result.status).toBe("partial");
  expect(result.rows.map((r) => [r.panel, r.state])).toEqual([["samplers", "failed"], ["guides", "applied"]]);
});

test("a busy scene is refused before anything is read or written", async () => {
  const fake = fakeLoadoutApi();
  const result = await runLoadout(input(fake, { busy: true }));
  expect(result.status).toBe("busy");
  expect(fake.calls).toEqual([]);
});

test("persona runs last, so the settings before it are already reported if the store refuses it", async () => {
  const fake = fakeLoadoutApi({ persona: "old" });
  fake.failing.add("persona");
  const result = await runLoadout(input(fake, { loadout: { id: "l5", name: "P", panels: ["persona", "authorNote"], values: { persona: "new", authorNote: note } }, strategies: { persona: "replace" } }));
  expect(fake.calls).toEqual(["receipt-save", "note", "persona", "receipt-finish"]);
  expect(result.rows.map((r) => [r.panel, r.state])).toEqual([["persona", "failed"], ["authorNote", "applied"]]);
  expect(result.status).toBe("partial");
});
