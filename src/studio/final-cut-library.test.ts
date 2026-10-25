/**
 * The Final Cut library's guards that need no server: an unreadable document is refused and never read as empty, ids come from labels in
 * the user/ namespace and cannot take a built-in id, two banks never share one, and only enabled, undeleted banks reach the prompt.
 */
import { expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { StudioValidationError } from "./errors";
import { deleteBank, finalCutBanksOf, listBanks, parseBank, saveBank } from "./final-cut-library";

const bank = { label: "Quiet Hum", kind: "phrase", pattern: "p", examples: ["x"], replace: "" };

test("the id is made from the label, or the id given, always under user/, and punctuation cannot reach the built-in space", () => {
  expect(parseBank(bank).bankId).toBe("user/quiet-hum");
  expect(parseBank({ ...bank, bankId: "wordbank/canonical-ai-tells" }).bankId).toBe("user/wordbank-canonical-ai-tells");
  expect(parseBank({ ...bank, bankId: "user/Mine!!" }).bankId).toBe("user/mine");
  expect(() => parseBank({ ...bank, label: "!!!" })).toThrow(StudioValidationError);
});

test("the caps are RoleCall's: 30 examples of at most 1,000, a pattern of at most 8,000, a known kind and scope", () => {
  for (const damage of [{ examples: [] }, { examples: Array.from({ length: 31 }, () => "x") }, { examples: ["x".repeat(1_001)] }, { pattern: "p".repeat(8_001) }, { kind: "wordbank" }, { scope: "never" }, { why: "w".repeat(4_001) }]) {
    expect(() => parseBank({ ...bank, ...damage })).toThrow(StudioValidationError);
  }
});

test("an unreadable document is refused, not read as empty, so a save cannot wipe what it failed to read", async () => {
  const state = memoryStateStore();
  await state.write("finalCut", "not json");
  await expect(listBanks(state)).rejects.toBeInstanceOf(StudioValidationError);
  await expect(saveBank(state, bank, 1)).rejects.toBeInstanceOf(StudioValidationError);
  expect(await state.read("finalCut")).toBe("not json");
});

test("only an enabled bank that is not deleted reaches the prompt, under its user/ id", async () => {
  const state = memoryStateStore();
  const on = await saveBank(state, bank, 1, () => "a");
  await saveBank(state, { ...bank, label: "Off One", enabled: false }, 2, () => "b");
  const gone = await saveBank(state, { ...bank, label: "Gone" }, 3, () => "c");
  await deleteBank(state, gone.id, 4);
  expect(Object.keys(await finalCutBanksOf(state))).toEqual(["user/quiet-hum"]);
  expect((await finalCutBanksOf(state))["user/quiet-hum"]).toMatchObject({ label: "Quiet Hum", kind: "phrase" });
  expect(on.enabled).toBe(true);
});
