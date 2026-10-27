/** A new Script Sheet saved twice is one piece: the second save updates it (the case a failed choose then an edit reaches). */
import { expect, test } from "bun:test";
import type { AppContext } from "../../app-contract";
import { newSheetSaver } from "./new-script-sheet";

test("the first save creates the sheet, later saves update that piece by its revision", async () => {
  const created: unknown[] = [];
  const edited: { entity: unknown; revision: string }[] = [];
  let stored: { kind: string; id: string; body: unknown } | null = null;
  const ctx = { api: {
    saveEntity: async (e: { kind: string; body: unknown }) => { created.push(e); stored = { kind: e.kind, id: "script-sheet", body: e.body }; return { id: "script-sheet", name: "Terse", revision: "r1" }; },
    getEditableEntity: async () => ({ entity: stored, revision: "r1" }),
    saveEditedEntity: async (entity: unknown, revision: string) => { edited.push({ entity, revision }); return { revision: "r2" }; },
  } } as unknown as AppContext;
  const saver = newSheetSaver(ctx);
  await saver.save({ name: "Terse", content: "Be brief." });
  await saver.save({ name: "Terser", content: "Be briefer." });
  expect(created).toHaveLength(1);
  expect(saver.id()).toBe("script-sheet");
  expect((created[0] as { kind: string }).kind).toBe("scriptsheet");
  expect(edited).toEqual([{ entity: { kind: "scriptsheet", id: "script-sheet", body: { name: "Terser", content: "Be briefer." } }, revision: "r1" }]);
});
