/** Renaming in the tracker editor, typed a key at a time: links follow the renamed field only, the prompt line follows the names it points at, and a prompt line that fails blocks the save. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TrackerBody } from "../../../../entities/tracker/schema";
import type { InstalledDom } from "../../../_shared/test-dom";
import { TrackerEditor } from "./tracker-editor";
import { installPieceDom, mountEditor } from "./fake-piece-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

const health: TrackerBody = {
  name: "Health", description: "", layout: "record", note: "",
  template: "{{tracker::Health::hp}}/{{tracker::Health::hp_max}} {{tracker::Other::hp_max}}",
  fields: [
    { name: "hp", description: "", type: "number", maxField: "hp_max", default: 3 },
    { name: "hp_max", description: "", type: "number", default: 5 },
    { name: "cur", description: "", type: "number", maxField: "hp", default: 1 },
  ],
};
/** The library holds this tracker as saved (piece p1, Health) and another tracker, Other. */
const library = async (kind: string) => (kind === "tracker" ? [{ id: "p1", kind, name: "Health" }, { id: "other", kind, name: "Other" }] : []);
const mount = (body: TrackerBody = health) => mountEditor(TrackerEditor, "tracker", body, { api: { listEntities: library } });
const bodyOf = (call: { patch: { head: unknown } }): TrackerBody => (call.patch.head as { body: TrackerBody }).body;

describe("a field renamed a key at a time", () => {
  test("typing through a sibling's name takes none of the sibling's links, and the prompt line follows to the last name", async () => {
    const m = await mount();
    await m.click(m.q('[data-pick="1"] button'));
    // hp_max passes through "hp", the name of the field cur follows
    for (const name of ["hp_ma", "hp", "hp_", "hp_max_bonus"]) await m.type(m.field("Field name"), name);
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!)).toEqual({
      ...health,
      template: "{{tracker::Health::hp}}/{{tracker::Health::hp_max_bonus}} {{tracker::Other::hp_max}}",
      fields: [{ ...health.fields[0]!, maxField: "hp_max_bonus" }, { ...health.fields[1]!, name: "hp_max_bonus" }, health.fields[2]!],
    });
    await m.unmount();
  });
});

describe("the tracker renamed", () => {
  test("its macros follow it, and another tracker's stay, whatever names it passes through", async () => {
    const m = await mount();
    for (const name of ["Other", "Vitals"]) await m.type(m.field("Tracker name"), name);
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!).name).toBe("Vitals");
    expect(bodyOf(m.saves[0]!).template).toBe("{{tracker::Vitals::hp}}/{{tracker::Vitals::hp_max}} {{tracker::Other::hp_max}}");
    expect(m.q('[aria-label="Prompt text"]').textContent).toBe("### Trackers\n\n3/5 {{tracker::Other::hp_max}}");
    await m.unmount();
  });
});

describe("a prompt line that fails", () => {
  test("is a problem under the header, in plain words, and is not saved", async () => {
    const m = await mount({ ...health, template: undefined });
    await m.type(m.field("Prompt line"), "{{tracker::Health::nope}}");
    expect(m.host.textContent).toContain("The prompt line has a problem: Health has no field nope.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    expect(m.status.at(-1)).toContain("The prompt line has a problem");
    await m.type(m.field("Prompt line"), "{{tracker::Health::hp}}");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(1);
    await m.unmount();
  });
});

describe("a prompt line that names another tracker", () => {
  test("is let through when that name is a tracker in the library, and blocked when it is a typo", async () => {
    const m = await mount({ ...health, template: undefined });
    await m.type(m.field("Prompt line"), "{{tracker::Other::hp_max}}");
    expect(m.host.textContent).not.toContain("The prompt line");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(1);
    await m.type(m.field("Prompt line"), "{{tracker::Othr::hp_max}}");
    expect(m.host.textContent).toContain("The prompt line reads a tracker called Othr, and there is no tracker with that name.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(1);
    await m.unmount();
  });

  test("a tracker's own name misspelled is blocked the same way, and the library's case does not matter", async () => {
    const m = await mount({ ...health, template: undefined });
    await m.type(m.field("Prompt line"), "{{tracker::Helth::hp}}");
    expect(m.host.textContent).toContain("called Helth");
    await m.type(m.field("Prompt line"), "{{tracker::other::hp}}");
    expect(m.host.textContent).not.toContain("The prompt line");
    await m.unmount();
  });

  test("when the library cannot be read nothing is let through", async () => {
    const m = await mountEditor(TrackerEditor, "tracker", { ...health, template: undefined }, { api: { listEntities: async () => { throw new Error("no"); } } });
    await m.type(m.field("Prompt line"), "{{tracker::Other::hp}}");
    expect(m.host.textContent).toContain("called Other");
    await m.unmount();
  });
});

describe("this tracker's own saved name", () => {
  test("is not another tracker: after renaming Health to Vitals, a hand-typed Health macro is a typo until saved", async () => {
    const m = await mount({ ...health, template: undefined });
    await m.type(m.field("Tracker name"), "Vitals");
    await m.type(m.field("Prompt line"), "{{tracker::Health::hp}}");
    expect(m.host.textContent).toContain("The prompt line reads a tracker called Health, and there is no tracker with that name.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    await m.type(m.field("Prompt line"), "{{tracker::Vitals::hp}}");
    expect(m.host.textContent).not.toContain("The prompt line reads");
    await m.unmount();
  });
});
