/** The dice editor as it mounts: each type's roll card on a seeded roll, the table's chances and lit row, pasting a list, and the one field a type keeps. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { DiceBody } from "../../../../entities/dice/schema";
import type { InstalledDom } from "../../../_shared/test-dom";
import { DiceEditor } from "./dice-editor";
import { installPieceDom, mountEditor } from "./fake-piece-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

/** A generator at 0.7: 15 on a d20, and 8 on the ten-sided chance die of the weather table. */
const rand = () => 0.7;
const weather: DiceBody = {
  name: "Weather", description: "Sky over the harbour.", type: "table",
  rows: [{ text: "Clear and cold", weight: 5 }, { text: "Sea fog rolls in", weight: 3 }, { text: "Squall from the west", weight: 1 }, { text: "Storm warning bells", weight: 1 }],
};
const mount = (body: DiceBody = weather) => mountEditor(DiceEditor, "dice", body, { rand });
/** The Roll button of the card (the kind switch has a Roll too, first). */
const roll = (m: { buttons(text: RegExp): HTMLButtonElement[] }): HTMLButtonElement => m.buttons(/^Roll$/).at(-1)!;
const bodyOf = (call: { patch: { head: unknown } }): DiceBody => (call.patch.head as { body: DiceBody }).body;

describe("a table", () => {
  test("shows each row's chance, and Roll lights the row the roll picked", async () => {
    const m = await mount();
    expect([...m.host.querySelectorAll('[data-part="piece.dice.chance"]')].map((c) => c.textContent)).toEqual(["50%", "30%", "10%", "10%"]);
    expect(m.host.querySelector("[data-lit]")).toBeNull();
    await m.click(roll(m));
    expect(m.q('[role="status"]').textContent).toBe("Rolled 8 of 10: Sea fog rolls in");
    expect((m.q("[data-lit] input[aria-label=Result]") as HTMLInputElement).value).toBe("Sea fog rolls in");
    await m.unmount();
  });

  test("editing the table drops the old roll's result, and a roll never changes the piece", async () => {
    const m = await mount();
    await m.click(roll(m));
    expect(m.saves).toHaveLength(0);
    expect(m.button(/^Saved$/).disabled).toBe(true);
    await m.type(m.q("[data-pick='0'] input[aria-label=Weight]"), "6");
    expect(m.host.querySelector("[data-lit]")).toBeNull();
    expect(m.q('[data-part="piece.dice.chance"]').textContent).toBe("55%");
    await m.unmount();
  });

  test("Paste a list adds one row per line at weight 1, and the save carries only the new rows", async () => {
    const m = await mount();
    await m.click(m.button(/Paste a list/));
    await m.type(m.field("Rows to paste"), "Heat haze\n\n  Hail  \n");
    await m.click(m.button(/^Add rows$/));
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!)).toEqual({ ...weather, rows: [...weather.rows!, { text: "Heat haze", weight: 1 }, { text: "Hail", weight: 1 }] });
    await m.unmount();
  });

  test("a row with no text is refused in words, Roll is off, and nothing is sent", async () => {
    const m = await mount();
    await m.click(m.button(/\+ Row/));
    expect(m.host.textContent).toContain("Row 5 needs some text and a weight of 1 or more.");
    expect(roll(m).disabled).toBe(true);
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });

  test("deleting a row saves the table without it", async () => {
    const m = await mount();
    await m.click(m.q("[data-pick='3'] button[aria-label='Delete row']"));
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!).rows).toEqual(weather.rows!.slice(0, 3));
    await m.unmount();
  });
});

describe("a roll and a pool", () => {
  test("a roll's card rolls its dice", async () => {
    const m = await mount({ name: "Luck", description: "", type: "roll", dice: "1d20+5" });
    await m.click(roll(m));
    expect(m.q('[role="status"]').textContent).toBe("[15] +5 = 20");
    await m.type(m.field("Dice"), "nonsense");
    expect(roll(m).disabled).toBe(true);
    expect(m.host.textContent).toContain("The dice must be like 2d6 or 1d20+3");
    await m.unmount();
  });

  test("a pool's card counts the dice at or over its target", async () => {
    const m = await mount({ name: "Pool", description: "", type: "pool", pool: { count: 5, sides: 10, target: 7 } });
    await m.click(roll(m));
    expect(m.q('[role="status"]').textContent).toBe("[8, 8, 8, 8, 8] = 5 successes");
    await m.type(m.field("Counts at"), "9");
    expect(m.host.querySelector('[role="status"]')?.textContent ?? "").not.toContain("successes");
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!).pool).toEqual({ count: 5, sides: 10, target: 9 });
    await m.unmount();
  });
});

describe("the type", () => {
  test("a piece keeps exactly the field its type rolls, and switching back brings the first back", async () => {
    const m = await mount();
    await m.click(m.button(/^Pool$/));
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!)).toEqual({ name: "Weather", description: "Sky over the harbour.", type: "pool", pool: { count: 3, sides: 6, target: 5 } });
    await m.click(m.button(/^Table$/));
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[1]!)).toEqual(weather);
    await m.unmount();
  });

  test("with nothing changed, nothing is sent", async () => {
    const m = await mount();
    await m.click(m.button(/^Saved$/));
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });
});
