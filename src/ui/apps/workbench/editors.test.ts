/** Which editor a piece opens in, read from its kind's kind.ts: each kind names one. */
import { expect, test } from "bun:test";
import { editorFor } from "./editors";

test("each kind opens in the editor its kind.ts names, read the way it says", () => {
  expect(editorFor("preset")?.id).toBe("preset");
  expect(editorFor("scriptsheet")?.id).toBe("scriptsheet");
  expect(editorFor("preset")?.load).toBe("light");
  expect(editorFor("lorebook")?.load).toBe("lore");
  expect(editorFor("promptformat")).toBeUndefined();
  expect(editorFor("not-a-kind")).toBeUndefined();
});

test("tracker, tool, dice and formula open in their own editors, read without their pictures", () => {
  for (const kind of ["tracker", "tool", "dice", "formula"]) {
    expect(editorFor(kind)?.id).toBe(kind);
    expect(editorFor(kind)?.load).toBe("light");
    expect(editorFor(kind)?.Editor).toBeFunction();
  }
});
