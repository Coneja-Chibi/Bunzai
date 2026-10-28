/** The field editor a tracker and a tool share, pressed as a person would: add, reorder and delete fields, switch a type, pick another field as a number's top. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { useState, type JSX } from "react";
import type { TrackerField } from "../../entities/tracker/schema";
import type { ToolField } from "../../entities/tool/schema";
import { installPieceDom, mountNode } from "../apps/workbench/pieces/fake-piece-rig";
import type { InstalledDom } from "./test-dom";
import { FieldEditor, type FieldChange } from "./field-editor";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

const num = (name: string, extra: Partial<TrackerField> = {}): TrackerField => ({ name, description: "", type: "number", ...extra });
const blank = (name: string): TrackerField => ({ name, description: "", type: "number", default: 0 });

/** Holds the list the way an editor does and records what the field editor last handed back. */
function Held({ initial, seen }: { initial: TrackerField[]; seen: { fields: TrackerField[]; change?: FieldChange } }): JSX.Element {
  const [fields, setFields] = useState(initial);
  seen.fields = fields;
  return <FieldEditor fields={fields} make={blank} onChange={(next, change) => { seen.change = change; setFields(next); }} />;
}

async function mountHeld(initial: TrackerField[]) {
  const seen: { fields: TrackerField[]; change?: FieldChange } = { fields: initial };
  const m = await mountNode(<Held initial={initial} seen={seen} />);
  return { m, seen };
}

describe("the field list", () => {
  test("New field adds a number named field, then field_2, and opens it", async () => {
    const { m, seen } = await mountHeld([num("hp")]);
    await m.click(m.button(/New field/));
    await m.click(m.button(/New field/));
    expect(seen.fields.map((f) => f.name)).toEqual(["hp", "field", "field_2"]);
    expect(seen.fields[2]).toEqual({ name: "field_2", description: "", type: "number", default: 0 });
    expect(m.field("Field name").value).toBe("field_2");
    await m.unmount();
  });

  test("Move up and Move down reorder the open field, and Delete removes it", async () => {
    const { m, seen } = await mountHeld([num("a"), num("b"), num("c")]);
    await m.click(m.button(/Move down/));
    expect(seen.fields.map((f) => f.name)).toEqual(["b", "a", "c"]);
    expect(m.field("Field name").value).toBe("a");
    await m.click(m.button(/Move up/));
    expect(seen.fields.map((f) => f.name)).toEqual(["a", "b", "c"]);
    await m.click(m.button(/Delete field/));
    expect(seen.fields.map((f) => f.name)).toEqual(["b", "c"]);
    expect(seen.change).toEqual({ removed: "a" });
    await m.unmount();
  });

  test("renaming a field is reported with the old name and the new, and carries a top that named it", async () => {
    const { m, seen } = await mountHeld([num("hp", { maxField: "hp_max" }), num("hp_max")]);
    await m.click(m.q('[data-pick="1"] button'));
    await m.type(m.field("Field name"), "max_hp");
    expect(seen.change).toMatchObject({ renamed: { from: "hp_max", to: "max_hp" } });
    expect(seen.fields.map((f) => f.name)).toEqual(["hp", "max_hp"]);
    expect(seen.fields[0]!.maxField).toBe("max_hp");
    await m.unmount();
  });

  test("typing a new name through a sibling's name takes none of the sibling's links, and the field's own follow to the last name", async () => {
    // cur follows hp_max (the field being renamed); other follows hp (a sibling whose name is typed through on the way)
    const { m, seen } = await mountHeld([num("hp"), num("hp_max"), num("cur", { maxField: "hp_max" }), num("other", { maxField: "hp" })]);
    await m.click(m.q('[data-pick="1"] button'));
    for (const name of ["h", "hp", "hp_", "hp_m", "hp_max", "hp_max_bonus"]) await m.type(m.field("Field name"), name);
    expect(seen.fields.map((f) => f.name)).toEqual(["hp", "hp_max_bonus", "cur", "other"]);
    expect(seen.fields[2]!.maxField).toBe("hp_max_bonus");
    expect(seen.fields[3]!.maxField).toBe("hp");
    // every keystroke is one rename that began with the name the field had when it started
    expect(seen.change).toMatchObject({ renamed: { from: "hp_max", to: "hp_max_bonus" } });
    await m.unmount();
  });

  test("a second rename after leaving the field begins from the name it has then", async () => {
    const { m, seen } = await mountHeld([num("a"), num("b", { maxField: "a" })]);
    await m.type(m.field("Field name"), "a2");
    await m.click(m.q('[data-pick="1"] button'));
    await m.click(m.q('[data-pick="0"] button'));
    await m.type(m.field("Field name"), "a3");
    expect(seen.fields[1]!.maxField).toBe("a3");
    expect(seen.change).toMatchObject({ renamed: { from: "a2", to: "a3" } });
    await m.unmount();
  });

  test("making a top field text frees the fields that followed it", async () => {
    const { m, seen } = await mountHeld([num("hp_max"), num("hp", { maxField: "hp_max" })]);
    await m.click(m.button(/^Text$/));
    expect(seen.fields[0]!.type).toBe("text");
    expect("maxField" in seen.fields[1]!).toBe(false);
    await m.unmount();
  });
});

describe("one field's page", () => {
  test("switching a number to choice drops its range and start, and a choice takes chips and a start", async () => {
    const { m, seen } = await mountHeld([num("mood", { min: 0, max: 5, default: 3 })]);
    await m.click(m.button(/^Choice$/));
    expect(seen.fields[0]).toEqual({ name: "mood", description: "", type: "choice", choices: [] });
    await m.type(m.field("New choice"), "calm");
    await m.click(m.button(/^Add$/));
    await m.type(m.field("New choice"), "tense");
    await m.click(m.button(/^Add$/));
    expect(seen.fields[0]!.choices).toEqual(["calm", "tense"]);
    await m.type(m.field<HTMLSelectElement>("Starts at"), "tense");
    expect(seen.fields[0]!.default).toBe("tense");
    await m.click(m.button(/Remove tense/));
    expect(seen.fields[0]!.choices).toEqual(["calm"]);
    expect("default" in seen.fields[0]!).toBe(false);
    await m.unmount();
  });

  test("a number's To can be a number, another number field, or none", async () => {
    const { m, seen } = await mountHeld([num("hp", { min: 0, default: 20 }), num("hp_max", { min: 1 }), { name: "mood", description: "", type: "text" }]);
    await m.click(m.button(/^Another field$/));
    // only the other number field is offered, never the text field or itself
    expect(seen.fields[0]!.maxField).toBe("hp_max");
    expect([...m.field<HTMLSelectElement>("Top field").options].map((o) => o.value)).toEqual(["hp_max"]);
    await m.click(m.button(/^A number$/));
    expect("maxField" in seen.fields[0]!).toBe(false);
    expect(seen.fields[0]!.max).toBe(20);
    await m.type(m.field("Top"), "30");
    expect(seen.fields[0]!.max).toBe(30);
    await m.click(m.buttons(/^None$/)[1]!);
    expect("max" in seen.fields[0]!).toBe(false);
    expect("maxField" in seen.fields[0]!).toBe(false);
    await m.unmount();
  });

  test("Another field is off while there is no other number field to take", async () => {
    const { m } = await mountHeld([num("hp")]);
    expect(m.button(/^Another field$/).disabled).toBe(true);
    await m.unmount();
  });

  test("From and Starts at keep blank as not set", async () => {
    const { m, seen } = await mountHeld([num("hp", { min: 1, default: 4 })]);
    await m.type(m.field("From"), "");
    await m.type(m.field("Starts at"), "");
    expect(seen.fields[0]).toEqual({ name: "hp", description: "", type: "number" });
    await m.unmount();
  });

  test("the icon picker sets and clears the field's glyph, and More... searches every glyph", async () => {
    const { m, seen } = await mountHeld([num("hp")]);
    await m.click(m.button(/^heart$/));
    expect(seen.fields[0]!.icon).toBe("lucide:heart");
    await m.click(m.button(/^None$/));
    expect("icon" in seen.fields[0]!).toBe(false);
    await m.click(m.button(/More/));
    await m.type(m.field("Search icons"), "skull");
    await m.click(m.button(/lucide:skull/));
    expect(seen.fields[0]!.icon).toBe("lucide:skull");
    await m.unmount();
  });
});

describe("as a tool's", () => {
  test("a tool field has no range or icon, but says whether the AI must fill it", async () => {
    let held: ToolField[] = [{ name: "dice", description: "", type: "text", required: false }];
    function Tool(): JSX.Element {
      const [fields, setFields] = useState(held);
      held = fields;
      return <FieldEditor tool fields={fields} make={(name) => ({ name, description: "", type: "text", required: false })} onChange={setFields} />;
    }
    const m = await mountNode(<Tool />);
    expect(m.host.textContent).not.toContain("Icon");
    expect(m.host.textContent).not.toContain("Starts at");
    await m.click(m.q('[role="switch"]'));
    expect(held[0]!.required).toBe(true);
    await m.click(m.button(/^Number$/));
    expect(held[0]).toEqual({ name: "dice", description: "", type: "number", required: true });
    expect(m.host.textContent).not.toContain("From");
    await m.unmount();
  });
});
