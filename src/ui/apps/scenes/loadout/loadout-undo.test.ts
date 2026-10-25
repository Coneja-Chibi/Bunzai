/**
 * Undoing an apply (loadout-undo.ts): each unit is put back through the same setter, in reverse order, only while the
 * scene still holds what the apply wrote; the 15 minute window runs on the clock the test gives it.
 */
import { describe, expect, test } from "bun:test";
import { LOADOUT_UNITS, UNDO_MS } from "../../../../core/loadout-panels";
import type { LoadoutReceipt } from "../../../../studio/loadout-record";
import type { SceneSettings } from "../../../app-contract-scenes";
import { fakeLoadoutApi } from "./fake-loadout-api";
import { runLoadout } from "./loadout-run";
import { undoReceipt } from "./loadout-undo";
import { liveUnit } from "./loadout-units";

const note = { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 } as const;
const start = (): SceneSettings => ({ persona: null, connection: { id: "old", model: "o" }, prompting: { guides: ["keep"] } });
const loadout = {
  id: "l1", name: "Slow burn", panels: ["mainModel", "lorebooks", "stagecraftProps", "guides", "authorNote"],
  values: { mainModel: { id: "c", model: "m" }, lorebooks: { added: ["b"], off: [] }, stagecraftProps: { on: ["dice"] }, guides: ["g"], authorNote: note },
};

/** Every unit reads as it did at the start; an empty list and an unset field count as the same. */
const expectStart = (scene: SceneSettings) => {
  for (const unit of LOADOUT_UNITS) expect(liveUnit(scene, unit)).toEqual(liveUnit(start(), unit));
};

async function applied(scene = start(), strategies = { guides: "replace" as const }) {
  const fake = fakeLoadoutApi(scene);
  const run = await runLoadout({ api: fake.api, chatId: "c1", loadout, strategies, now: fake.clock.now, newCode: () => "LD-1" });
  fake.calls.length = 0;
  return { fake, receipt: run.receipt as LoadoutReceipt };
}
const undo = (fake: ReturnType<typeof fakeLoadoutApi>, receipt: LoadoutReceipt, over = {}) => undoReceipt({ api: fake.api, receipt, openChatId: "c1", now: fake.clock.now + 1000, ...over });

describe("a clean undo", () => {
  test("puts the scene back exactly as it was, writing the units in reverse order, and closes the receipt", async () => {
    const { fake, receipt } = await applied();
    const result = await undo(fake, receipt);
    expect(fake.calls).toEqual(["note", "guides", "props", "lore", "connection", "receipt-undone"]);
    expect(result.status).toBe("undone");
    expect(result.rows.map((r) => r.result)).toEqual(Array(5).fill("restored"));
    expectStart(fake.scene);
    expect(fake.receipts.get("LD-1")!.undoneAt).toBeDefined();
  });

  test("a lore the scene never had comes back as none, not as an empty list", async () => {
    const { fake, receipt } = await applied();
    await undo(fake, receipt);
    expect(liveUnit(fake.scene, "lore")).toBeNull();
    expect(liveUnit(fake.scene, "props")).toBeNull();
  });
});

describe("the three-way check", () => {
  test("a setting changed after the apply is left alone and the rest still go back", async () => {
    const { fake, receipt } = await applied();
    fake.scene.lore = { added: ["b", "mine"], off: [] };
    const result = await undo(fake, receipt);
    expect(result.status).toBe("undone");
    expect(Object.fromEntries(result.rows.map((r) => [r.unit, r.result]))).toEqual({ connection: "restored", lore: "left-alone", props: "restored", guides: "restored", note: "restored" });
    expect(fake.calls).not.toContain("lore");
    expect(fake.scene.lore).toEqual({ added: ["b", "mine"], off: [] });
    expect(fake.scene.connection).toEqual({ id: "old", model: "o" });
  });

  test("a setting already back to what it was is not written again", async () => {
    const { fake, receipt } = await applied();
    fake.scene.connection = { id: "old", model: "o" };
    const result = await undo(fake, receipt);
    expect(result.rows.find((r) => r.unit === "connection")!.result).toBe("already-restored");
    expect(fake.calls).not.toContain("connection");
  });

  test("key order never decides: the scene's object written in another order still counts as what the apply wrote", async () => {
    const { fake, receipt } = await applied();
    fake.scene.connection = { model: "m", id: "c" };
    fake.scene.prompting = { note: { frequency: 2, depth: 4, position: "in_chat", text: "Tense." }, guides: ["g"] };
    const result = await undo(fake, receipt);
    expect(result.rows.find((r) => r.unit === "connection")!.result).toBe("restored");
    expect(result.rows.find((r) => r.unit === "note")!.result).toBe("restored");
  });

  test("an empty list and an unset field are the same: lore that is now empty counts as already restored", async () => {
    const { fake, receipt } = await applied();
    fake.scene.lore = { added: [], off: [] };
    expect((await undo(fake, receipt)).rows.find((r) => r.unit === "lore")!.result).toBe("already-restored");
  });
});

describe("the window and the scene", () => {
  test("inside the 15 minutes it works, at the minute it ends it is refused, and nothing is touched", async () => {
    const { fake, receipt } = await applied();
    const late = await undo(fake, receipt, { now: receipt.undoUntil });
    expect(late).toMatchObject({ status: "refused", error: "That loadout undo window has expired." });
    expect(fake.calls).toEqual([]);
    expect((await undo(fake, receipt, { now: receipt.undoUntil - 1 })).status).toBe("undone");
    expect(receipt.undoUntil - receipt.appliedAt).toBe(UNDO_MS);
  });

  test("another scene's receipt, an undone one, and a busy scene are refused with a message, touching nothing", async () => {
    const { fake, receipt } = await applied();
    expect(await undo(fake, receipt, { openChatId: "c2" })).toMatchObject({ status: "refused", error: "That receipt belongs to a different scene." });
    expect(await undo(fake, { ...receipt, undoneAt: 1 })).toMatchObject({ status: "refused", error: "That loadout was already undone." });
    expect(await undo(fake, receipt, { busy: true })).toMatchObject({ status: "refused" });
    expect(fake.calls).toEqual([]);
  });
});

describe("failures", () => {
  test("a setter that fails is reported, the rest still go back, and the receipt stays open for a retry that touches only that unit", async () => {
    const { fake, receipt } = await applied();
    fake.failing.add("props");
    const first = await undo(fake, receipt);
    expect(first.status).toBe("partial");
    expect(Object.fromEntries(first.rows.map((r) => [r.unit, r.result]))).toEqual({ connection: "restored", lore: "restored", props: "failed", guides: "restored", note: "restored" });
    expect(first.rows.find((r) => r.unit === "props")!.error).toBe("props refused");
    expect(fake.calls).not.toContain("receipt-undone");
    expect(fake.receipts.get("LD-1")!.undoneAt).toBeUndefined();

    fake.failing.clear();
    fake.calls.length = 0;
    const second = await undo(fake, receipt);
    expect(fake.calls).toEqual(["props", "receipt-undone"]);
    expect(second.status).toBe("undone");
    expectStart(fake.scene);
  });

  test("rows the apply never wrote are skipped, not restored", async () => {
    const fake = fakeLoadoutApi(start());
    fake.failing.add("props");
    const run = await runLoadout({ api: fake.api, chatId: "c1", loadout, strategies: { guides: "replace" }, now: fake.clock.now, newCode: () => "LD-1" });
    fake.failing.clear();
    fake.calls.length = 0;
    const result = await undo(fake, run.receipt!);
    expect(Object.fromEntries(result.rows.map((r) => [r.unit, r.result]))).toEqual({ connection: "restored", lore: "restored", props: "skipped", guides: "skipped", note: "skipped" });
    expect(fake.calls).toEqual(["lore", "connection", "receipt-undone"]);
  });

  test("the receipt that could not be closed is a warning, not a failed undo", async () => {
    const { fake, receipt } = await applied();
    fake.failing.add("receipt-undone");
    const result = await undo(fake, receipt);
    expect(result.status).toBe("undone");
    expect(result.warning).toBe("Undone, but the undo record could not be closed. Undo may still be offered.");
    expectStart(fake.scene);
  });
});
