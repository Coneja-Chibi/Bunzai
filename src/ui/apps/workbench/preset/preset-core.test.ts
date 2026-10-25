/** Characterization of the pure preset editor helpers: selection flips, entity parsing, group reveal and edit touches. */
import { describe, expect, test } from "bun:test";
import { OccurrenceIndex } from "../../../_shared/editor-state";
import type { PresetBody, PresetPrompt } from "../../../../entities/preset";
import { bodyFieldTouch, bodyFromEntity, editablePreset, flip, groupAncestors, promptTouch } from "./preset-core";

const prompt = (id: string, groupId?: string): PresetPrompt => ({ id, name: id, content: "", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", ...(groupId ? { groupId } : {}) }) as PresetPrompt;

describe("preset core", () => {
  test("flip toggles without mutating its input", () => {
    const start = new Set(["a"]);
    expect([...flip(start, "b")]).toEqual(["a", "b"]);
    expect([...flip(start, "a")]).toEqual([]);
    expect([...start]).toEqual(["a"]);
  });

  test("bodyFromEntity clones a real body and falls back to an empty preset", () => {
    const body = { name: "P", prompts: [prompt("x")] };
    const out = bodyFromEntity({ body });
    expect(out).toEqual(body);
    expect(out).not.toBe(body);
    expect(bodyFromEntity({ body: { name: 3 } })).toEqual({ name: "Untitled preset", prompts: [] });
    expect(bodyFromEntity(null)).toEqual({ name: "Untitled preset", prompts: [] });
  });

  test("editablePreset refuses a response for another entity", () => {
    expect(() => editablePreset({ kind: "preset", id: "b", body: {} }, "a")).toThrow("canonical body");
    expect(() => editablePreset({ kind: "preset", id: "a", body: {} }, "a")).not.toThrow();
  });

  test("groupAncestors walks the parent chain and stops on a cycle", () => {
    const body = {
      name: "P", prompts: [prompt("x", "g1")],
      groups: [{ id: "g1", name: "1", parentGroupId: "g2" }, { id: "g2", name: "2", parentGroupId: "g1" }],
    } as unknown as PresetBody;
    expect([...groupAncestors(body, "x")]).toEqual(["g1", "g2"]);
    expect(groupAncestors(body, "missing").size).toBe(0);
  });

  test("touches read and write only the addressed prompt or field", () => {
    const body = { name: "P", prompts: [prompt("a"), prompt("b")] } as PresetBody;
    const index = new OccurrenceIndex<PresetPrompt>();
    index.rebuild(body.prompts, (p) => p.id);
    const touch = promptTouch("b", index);
    const next = touch.write!(body, [{ ...body.prompts[1]!, content: "hi" }]);
    expect(next.prompts[0]).toBe(body.prompts[0]);
    expect(next.prompts[1]!.content).toBe("hi");
    expect(bodyFieldTouch("name").write!(body, "Q").name).toBe("Q");
  });
});
