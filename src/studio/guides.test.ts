/**
 * The guide library (studio/guides.ts): RoleCall's guide fields kept in the library's state, a delete that
 * keeps the record, and a document that cannot be read being refused rather than read as empty.
 */
import { describe, expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { deleteGuide, listGuides, saveGuide, selectedGuides } from "./guides";
import { documentLibraryContract } from "./state-store.contract";
import { StudioValidationError } from "./errors";

const ids = () => {
  let n = 0;
  return () => `g${++n}`;
};
const fields = { title: "Slow burn", content: "Let it simmer." };

describe("saving guides", () => {
  test("a new guide takes RoleCall's defaults: a user-role, situational, standard guide", async () => {
    const state = memoryStateStore();
    const saved = await saveGuide(state, fields, 100, ids());
    expect(saved).toEqual({ ...fields, id: "g1", type: "guide", category: "situational", role: "user", mode: "standard", depth: null, target: null, side: null, visible: true, createdAt: 100, updatedAt: 100 });
    expect(await listGuides(state)).toEqual([saved]);
  });

  test("saving with an id replaces its fields, keeps its creation time, and moves it first", async () => {
    const state = memoryStateStore();
    const next = ids();
    const a = await saveGuide(state, fields, 100, next);
    await saveGuide(state, { title: "B", content: "b" }, 200, next);
    const edited = await saveGuide(state, { id: a.id, ...fields, title: "Slower", mode: "append", depth: 2 }, 300, next);
    expect(edited).toMatchObject({ id: "g1", title: "Slower", mode: "append", depth: 2, createdAt: 100, updatedAt: 300 });
    expect((await listGuides(state)).map((g) => g.id)).toEqual(["g1", "g2"]);
  });

  test("depth belongs to depth and append, the macro target and side to macro, and nothing leaks across modes", async () => {
    const state = memoryStateStore();
    const next = ids();
    expect(await saveGuide(state, { ...fields, mode: "depth", depth: 100 }, 1, next)).toMatchObject({ depth: 100, target: null, side: null });
    expect(await saveGuide(state, { ...fields, mode: "macro", depth: 7 }, 1, next)).toMatchObject({ depth: null, target: "persona", side: "append" });
    expect(await saveGuide(state, { ...fields, mode: "macro", target: "scenario", side: "prepend" }, 1, next)).toMatchObject({ target: "scenario", side: "prepend" });
    expect(await saveGuide(state, { ...fields, mode: "chat_start", target: "scenario", depth: 3 }, 1, next)).toMatchObject({ depth: null, target: null, side: null });
  });
});

describe("deleting and switching on", () => {
  test("a delete leaves every list but the library keeps the record", async () => {
    const state = memoryStateStore();
    const g = await saveGuide(state, fields, 100, ids());
    expect(await deleteGuide(state, g.id, 200)).toBe(true);
    expect(await deleteGuide(state, g.id, 300)).toBe(false);
    expect(await listGuides(state)).toEqual([]);
    expect(JSON.parse((await state.read("guides"))!).guides).toEqual([{ ...g, deletedAt: 200 }]);
  });

  test("a scene's guides come back in the order it switched them on, without the missing, deleted and hidden", async () => {
    const state = memoryStateStore();
    const next = ids();
    const a = await saveGuide(state, { ...fields, content: "A" }, 1, next);
    const b = await saveGuide(state, { ...fields, content: "B", role: "system" }, 2, next);
    const c = await saveGuide(state, { ...fields, content: "C", visible: false }, 3, next);
    const d = await saveGuide(state, { ...fields, content: "D" }, 4, next);
    await deleteGuide(state, d.id, 5);
    expect(await selectedGuides(state, [b.id, "gone", c.id, d.id, a.id])).toEqual([
      { id: "g2", content: "B", role: "system", mode: "standard", depth: null, target: null, side: null },
      { id: "g1", content: "A", role: "user", mode: "standard", depth: null, target: null, side: null },
    ]);
    expect(await selectedGuides(state, undefined)).toEqual([]);
  });

  test("a document that cannot be read is refused, never read as empty, and a save does not overwrite it", async () => {
    for (const text of ["{broken", "[]", JSON.stringify({ guides: [{ id: "x" }] }), JSON.stringify({ guides: [{ id: "x", createdAt: 1, updatedAt: 1, title: "T", content: "C", mode: "sideways" }] })]) {
      const state = memoryStateStore();
      await state.write("guides", text);
      await expect(listGuides(state)).rejects.toBeInstanceOf(StudioValidationError);
      await expect(saveGuide(state, fields, 1, ids())).rejects.toBeInstanceOf(StudioValidationError);
      expect(await state.read("guides")).toBe(text);
    }
  });
});

documentLibraryContract({
  name: "guides",
  newState: memoryStateStore,
  key: "guides",
  save: saveGuide,
  list: listGuides,
  remove: deleteGuide,
  good: (n) => ({ ...fields, title: `Guide ${n}` }),
  bad: [
    { ...fields, title: "  " },
    { ...fields, content: "" },
    { ...fields, title: "x".repeat(201) },
    { ...fields, content: "x".repeat(10_001) },
    { ...fields, role: "tool" },
    { ...fields, mode: "sideways" },
    { ...fields, category: "mood" },
    { ...fields, type: "poem" },
    { ...fields, mode: "depth", depth: 101 },
    { ...fields, mode: "depth", depth: 1.5 },
    { ...fields, mode: "macro", target: "lore" },
    { ...fields, visible: "yes" },
    { ...fields, autoTrigger: true },
    "x",
    null,
  ],
});
