/** The tracker editor as it mounts in the Workbench: what it shows, what a save sends (only the change, and nothing when nothing changed), and what it refuses. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import type { TrackerBody } from "../../../../entities/tracker/schema";
import type { InstalledDom } from "../../../_shared/test-dom";
import { TrackerEditor } from "./tracker-editor";
import { installPieceDom, mountEditor, tick } from "./fake-piece-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

const health: TrackerBody = {
  name: "Health", description: "Vera's health.", layout: "record", note: "Lower hp when Vera is hurt.",
  fields: [
    { name: "hp", description: "Current hit points.", type: "number", min: 0, maxField: "hp_max", default: 20 },
    { name: "hp_max", description: "", type: "number", min: 1, default: 20 },
    { name: "mood", description: "", type: "choice", choices: ["calm", "tense", "hurt"], default: "calm" },
  ],
};

const mount = () => mountEditor(TrackerEditor, "tracker", health);

describe("what it shows", () => {
  test("the settings, the fields, and what the AI reads with what it costs", async () => {
    const m = await mount();
    expect(m.host.textContent).toContain("Identity & settings");
    expect(m.field("What it tracks").value).toBe("Vera's health.");
    expect(m.field("Field name").value).toBe("hp");
    const rows = [...m.host.querySelectorAll("[data-pick]")].map((r) => r.textContent ?? "");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toContain("mood");
    expect(rows[2]).toContain("calm, tense, hurt");
    expect(m.q('[aria-label="Prompt text"]').textContent).toBe("### Trackers\n\nHealth: hp=20, hp_max=20, mood=calm");
    expect(m.host.textContent).toMatch(/Adds to every reply~\d+/);
    await m.click(m.button(/^Update tool$/));
    expect(m.q('[aria-label="Update tool line"]').textContent).toContain("Health (record): hp (number 0 to hp_max: Current hit points.)");
    await m.unmount();
  });

  test("a prompt line shows as the AI would read it, and clearing it brings the plain line back and removes the key", async () => {
    const m = await mount();
    await m.type(m.field("Prompt line"), "Vera: {{tracker::Health::hp}}/{{tracker::Health::hp_max}} hp.");
    expect(m.q('[aria-label="Prompt text"]').textContent).toBe("### Trackers\n\nVera: 20/20 hp.");
    await m.click(m.button(/^Save$/));
    expect(m.saves[0]!.patch.head).toMatchObject({ body: { template: "Vera: {{tracker::Health::hp}}/{{tracker::Health::hp_max}} hp." } });
    await m.type(m.field("Prompt line"), "");
    expect(m.q('[aria-label="Prompt text"]').textContent).toBe("### Trackers\n\nHealth: hp=20, hp_max=20, mood=calm");
    await m.click(m.button(/^Save$/));
    expect("template" in (m.saves[1]!.patch.head as { body: object }).body).toBe(false);
    await m.unmount();
  });
});

describe("saving", () => {
  test("a change is sent once, on the revision opened, and it is the only change", async () => {
    const m = await mount();
    await m.type(m.field("How the AI should update it"), "Raise hp when she rests.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(1);
    expect(m.saves[0]!.kind).toBe("tracker");
    expect(m.saves[0]!.expected).toBe("r1");
    expect((m.saves[0]!.patch.head as { body: unknown }).body).toEqual({ ...health, note: "Raise hp when she rests." });
    expect(m.status.at(-1)).toBe("saved tracker · Health");
    expect(m.button(/^Saved$/).disabled).toBe(true);
    await m.click(m.button(/^Saved$/));
    expect(m.saves).toHaveLength(1);
    await m.unmount();
  });

  test("with nothing changed, Save is off and neither a click nor Ctrl+S sends anything", async () => {
    const m = await mount();
    expect(m.button(/^Saved$/).disabled).toBe(true);
    await m.click(m.button(/^Saved$/));
    await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "s", ctrlKey: true })); await tick(); });
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });

  test("an edit that is undone by hand leaves nothing to save", async () => {
    const m = await mount();
    await m.type(m.field("How the AI should update it"), "x");
    await m.type(m.field("How the AI should update it"), health.note);
    expect(m.button(/^Saved$/).disabled).toBe(true);
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });

  test("a draft the decoder refuses says why and is not sent", async () => {
    const m = await mount();
    await m.type(m.field("Field name"), "Bad Name");
    expect(m.host.textContent).toContain('Field "Bad Name" needs a name of lowercase letters, digits and _, starting with a letter.');
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    expect(m.status.at(-1)).toContain("needs a name");
    await m.unmount();
  });

  test("shape, change style and icon are saved as the tracker's own settings", async () => {
    const m = await mount();
    await m.click(m.button(/^A list of rows$/));
    await m.click(m.button(/^Card$/));
    await m.click(m.q('[aria-label="Tracker icon"] button[title="lucide:star"]'));
    await m.click(m.button(/^Save$/));
    expect((m.saves[0]!.patch.head as { body: unknown }).body).toEqual({ ...health, layout: "list", changes: "card", icon: "lucide:star" });
    await m.unmount();
  });
});
