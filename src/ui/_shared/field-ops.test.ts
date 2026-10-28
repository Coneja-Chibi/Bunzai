/** The field list edits: a rename carries the tops that name the field, a delete frees them, a retype drops what the new type cannot hold, and a top never closes a loop. */
import { describe, expect, test } from "bun:test";
import type { TrackerField } from "../../entities/tracker/schema";
import { addField, moveItem, removeField, renameField, retype, retypeField, topCandidates } from "./field-ops";

const num = (name: string, extra: Partial<TrackerField> = {}): TrackerField => ({ name, description: "", type: "number", ...extra });
const names = (fields: readonly { name: string }[]): string[] => fields.map((f) => f.name);

describe("adding", () => {
  test("a new field takes a free name, then the next free number", () => {
    const one = addField([], "field", (name) => num(name));
    const two = addField(one, "field", (name) => num(name));
    const three = addField(two, "field", (name) => num(name));
    expect(names(three)).toEqual(["field", "field_2", "field_3"]);
  });
});

describe("moving", () => {
  test("a field moves one place and an edge stays", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("renaming and removing", () => {
  const fields = [num("hp", { maxField: "hp_max" }), num("hp_max"), num("xp")];

  test("a rename carries the top that named the field", () => {
    const renamed = renameField(fields, 1, "max_hp");
    expect(names(renamed)).toEqual(["hp", "max_hp", "xp"]);
    expect(renamed[0]!.maxField).toBe("max_hp");
    expect(renamed[2]).toBe(fields[2]!);
  });

  test("a rename typed through a sibling's name keeps every link where it was (the review's probe)", () => {
    // cur follows hp; the author edits "hpx" -> "hp" -> "hpy". Each keystroke reads the links from the list as the rename began.
    const start: TrackerField[] = [num("hp"), num("hpx"), num("cur", { maxField: "hp" })];
    let now = start;
    for (const name of ["hp", "hpy"]) now = renameField(now, 1, name, start);
    expect(names(now)).toEqual(["hp", "hpy", "cur"]);
    expect(now[2]!.maxField).toBe("hp");
  });

  test("the fields that followed the renamed one follow it through every name, and stop at the last", () => {
    const start: TrackerField[] = [num("hp", { maxField: "hp_max" }), num("hp_max")];
    let now = start;
    for (const name of ["hp", "hp_m", "hp_max_bonus"]) now = renameField(now, 1, name, start);
    expect(now[0]!.maxField).toBe("hp_max_bonus");
  });

  test("removing a field frees every top that named it, and leaves the rest as they were", () => {
    const left = removeField(fields, 1);
    expect(names(left)).toEqual(["hp", "xp"]);
    expect("maxField" in left[0]!).toBe(false);
    expect(left[1]).toBe(fields[2]!);
  });
});

describe("changing type", () => {
  test("a number's range and start do not follow it to text", () => {
    const text = retype(num("hp", { min: 0, max: 9, default: 5, icon: "lucide:heart" }), "text");
    expect(text).toEqual({ name: "hp", description: "", type: "text", icon: "lucide:heart" });
  });

  test("a choice field starts with no choices, and the same type is the same field", () => {
    const field = num("mood");
    expect(retype(field, "choice")).toEqual({ name: "mood", description: "", type: "choice", choices: [] });
    expect(retype(field, "number")).toBe(field);
  });

  test("making a top field another type frees the fields that followed it, and a number stays a top", () => {
    const fields = [num("hp_max"), num("hp", { maxField: "hp_max" })];
    const text = retypeField(fields, 0, "text");
    expect(text[0]!.type).toBe("text");
    expect("maxField" in text[1]!).toBe(false);
    expect(retypeField(fields, 0, "number")).toEqual(fields);
  });

  test("a top taken from another field is dropped with the number type", () => {
    expect(retype(num("hp", { maxField: "hp_max" }), "boolean")).toEqual({ name: "hp", description: "", type: "boolean" });
  });
});

describe("which fields can be a top", () => {
  test("only other number fields, and none that would loop back", () => {
    const fields: TrackerField[] = [num("a", { maxField: "b" }), num("b"), num("c", { maxField: "a" }), { name: "mood", description: "", type: "text" }];
    // b taking a or c would close a loop (a follows b, c follows a), so b has no top to take
    expect(topCandidates(fields, 1)).toEqual([]);
    // c may take a or b: neither leads back to c
    expect(topCandidates(fields, 2)).toEqual(["a", "b"]);
    // a may take b, but not c (c follows a), and the text field is never offered
    expect(topCandidates(fields, 0)).toEqual(["b"]);
  });
});
