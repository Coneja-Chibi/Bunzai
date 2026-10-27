/** Fan Favorite, the story folder and the opening message (Overview), the backdrop blur (Pictures), the Context Pressure marks (Memory) and the tracker, Prop and TrackHare rows (Features): stored values read, writes reach the existing writer. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { legacyProps } from "../../../props/trackers/legacy";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { featuresCategories } from "./features";
import { memoryCategory } from "./memory";
import { overviewCategory } from "./overview";
import { picturesCategory } from "./pictures";
import { HARE_ROWS, TOOLTIPS_ROW } from "./prop-pref-rows";
import { bodyOfSection, control, rig, rowOf, setValue, wait } from "./fake-scene-rig";
import { stub } from "./writing-test-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8431); });
afterAll(async () => { await teardownAllDoms(); });

const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const GREETINGS = { greetings: { firstMessage: "Hello.", alternateGreetings: ["Hi there."] } };

describe("Overview: Fan Favorite and the story folder", () => {
  test("Fan Favorite reads the star and writes through setSceneFavorite", async () => {
    const r = rig({ chat: { favoredAt: 5 } as never });
    stub(r, "setSceneFavorite", () => r.a.scene.chat);
    stub(r, "listSceneFolders", () => []);
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "scene"));
    expect(control<HTMLElement>(m.host, "Fan Favorite").getAttribute("aria-checked")).toBe("true");
    control<HTMLElement>(m.host, "Fan Favorite").click();
    await wait(30);
    expect(r.calls["setSceneFavorite"]).toEqual([["c1", false]]);
    m.done();
  });

  test("the folder row lists the folders with No folder, shows the scene's and writes setSceneFolder", async () => {
    const r = rig({ chat: { folderId: "f1" } as never });
    stub(r, "listSceneFolders", () => [{ id: "f1", name: "Noir", createdAt: 1, count: 2 }, { id: "f2", name: "Heists", createdAt: 2, count: 1 }]);
    stub(r, "setSceneFolder", () => r.a.scene.chat);
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "scene"));
    await wait(40);
    const select = control<HTMLSelectElement>(m.host, "Story folder");
    expect(select.value).toBe("f1");
    expect([...select.options].map((o) => o.textContent)).toEqual(["No folder", "Noir", "Heists"]);
    setValue(select, "");
    await wait(30);
    setValue(select, "f2");
    await wait(30);
    expect(r.calls["setSceneFolder"]).toEqual([["c1", null], ["c1", "f2"]]);
    m.done();
  });

  test("no folder row while there are no folders", async () => {
    const r = rig();
    stub(r, "listSceneFolders", () => []);
    stub(r, "setSceneFavorite", () => r.a.scene.chat);
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "scene"));
    await wait(40);
    expect(m.host.querySelector('[aria-label="Story folder"]')).toBeNull();
    m.done();
  });
});

describe("Overview: the opening message", () => {
  test("the pick is the page's greeting state and the text is kept on the scene with the greeting editor's rule", async () => {
    const r = rig({ character: GREETINGS });
    const picked: number[] = [];
    const replaced: unknown[] = [];
    Object.assign(r.a, { greeting: { index: 0, pick: (i: number) => { picked.push(i); } }, replaceScene: (s: unknown) => { replaced.push(s); } });
    const cat = overviewCategory(r.a, r.open);
    expect(cat.sections.map((s) => s.id)).toEqual(["scene", "opening"]);
    const m = await mount(bodyOfSection(cat, "opening"));
    const text = control<HTMLTextAreaElement>(m.host, "Opening message text");
    expect(text.value).toBe("Hello.");
    setValue(control<HTMLSelectElement>(m.host, "Opening message"), "1");
    expect(picked).toEqual([1]);
    setValue(text, "Hello, stranger.");
    await wait(550);
    expect(r.calls["editScene"]).toEqual([["opening", { chatId: "c1", opening: { edits: [{ index: 0, text: "Hello, stranger." }] } }]]);
    expect(replaced).toHaveLength(1);
    setValue(text, "   ");
    await wait(550);
    expect(r.calls["editScene"]).toHaveLength(1);
    m.done();
  });

  test("a saved edit shows instead of the card's text, and writing the card's own text back drops the edit", async () => {
    const r = rig({ character: GREETINGS, chat: { opening: { edits: [{ index: 0, text: "Mine." }] } } as never });
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "opening"));
    const text = control<HTMLTextAreaElement>(m.host, "Opening message text");
    expect(text.value).toBe("Mine.");
    setValue(text, "Hello.");
    await wait(550);
    expect(r.calls["editScene"]).toEqual([["opening", { chatId: "c1", opening: null }]]);
    m.done();
  });

  test("the section is not drawn once the scene has messages, and a single greeting has no pick", async () => {
    const sent = rig({ character: GREETINGS });
    (sent.a.scene as { messages: unknown[] }).messages = [{ id: "m1" }];
    expect(overviewCategory(sent.a, sent.open).sections.map((s) => s.id)).toEqual(["scene"]);
    const one = rig({ character: { greetings: { firstMessage: "Hello." } } });
    Object.assign(one.a, { greeting: { index: 0, pick: () => undefined } });
    const m = await mount(bodyOfSection(overviewCategory(one.a, one.open), "opening"));
    expect(m.host.querySelector('[aria-label="Opening message"]')).toBeNull();
    expect(control<HTMLTextAreaElement>(m.host, "Opening message text").value).toBe("Hello.");
    m.done();
  });
});

describe("Pictures: backdrop blur", () => {
  test("blur reads the backdrop and saves it as the backdrop picker does, leaving none stored at 0", async () => {
    const r = rig({ chat: { backdrop: { pack: "p1", item: "i1", dim: 0.4, blur: 6 } } as never });
    const m = await mount(bodyOfSection(picturesCategory(r.a, r.open), "backdrop"));
    await wait(30);
    const slider = control<HTMLInputElement>(m.host, "Blur");
    expect(slider.value).toBe("6");
    setValue(slider, "12");
    await wait(550);
    setValue(slider, "0");
    await wait(550);
    expect(r.calls["setSceneBackdrop"]).toEqual([["c1", { pack: "p1", item: "i1", dim: 0.4, blur: 12 }], ["c1", { pack: "p1", item: "i1", dim: 0.4 }]]);
    m.done();
  });
});

describe("Memory: Context Pressure", () => {
  test("the marks and the target read the prefs and write the keys the Lore state view writes", async () => {
    const r = rig({ prefs: [["context.thresholds", { warning: 60, danger: 80, critical: 90 }], ["context.target", 8192]] });
    const m = await mount(bodyOfSection(memoryCategory(r.a, r.open), "inspector"));
    expect(control<HTMLInputElement>(m.host, "Warning mark").value).toBe("60");
    expect(control<HTMLInputElement>(m.host, "Context target").value).toBe("8192");
    setValue(control<HTMLInputElement>(m.host, "Danger mark"), "75");
    await wait(30);
    expect(r.prefs.get("context.thresholds")).toEqual({ warning: 60, danger: 75, critical: 90 });
    setValue(control<HTMLInputElement>(m.host, "Context target"), "0");
    await wait(550);
    expect(r.prefs.get("context.target")).toBeNull();
    setValue(control<HTMLInputElement>(m.host, "Context target"), "500");
    await wait(550);
    expect(r.prefs.get("context.target")).toBeNull();
    setValue(control<HTMLInputElement>(m.host, "Context target"), "4096");
    await wait(550);
    expect(r.prefs.get("context.target")).toBe(4096);
    m.done();
  });
});

describe("Features: tracker rows and Prop preferences", () => {
  const inventory = legacyProps.find((p) => p.id === "tracker-inventory")!;
  const withInventory = (): ReturnType<typeof rig> => rig({ registeredProps: [inventory], propsOn: [inventory.id], chat: { props: { on: [inventory.id] }, trackers: { inventory: { context: "every2", auto: { every: 4 } } } } as never });

  test("each legacy tracker on has an AI context row that writes through the tracker's own writer", async () => {
    const r = withInventory();
    const cat = featuresCategories(r.a, r.open).find((c) => c.id === "trackers")!;
    const m = await mount(bodyOfSection(cat, "tracker-each"));
    await wait(40);
    const select = control<HTMLSelectElement>(m.host, `${inventory.name}: AI context`);
    expect(select.value).toBe("every2");
    expect([...select.options].map((o) => o.textContent)).toEqual(["Always include", "Every 2 turns", "Every 5 turns", "Never include"]);
    setValue(select, "never");
    await wait(40);
    setValue(select, "always");
    await wait(40);
    expect(r.calls["setSceneTracker"]).toEqual([["c1", "inventory", { context: "never" }], ["c1", "inventory", { context: null }]]);
    m.done();
  });

  test("the Story Director's per-tracker switch and number write the tracker's auto, and Use default clears the number", async () => {
    const r = withInventory();
    const cat = featuresCategories(r.a, r.open).find((c) => c.id === "trackers")!;
    const m = await mount(bodyOfSection(cat, "tracker-each"));
    await wait(60);
    const every = control<HTMLInputElement>(m.host, `${inventory.name}: every N replies`);
    expect(every.value).toBe("4");
    setValue(every, "9");
    await wait(550);
    control<HTMLElement>(m.host, `${inventory.name}: update automatically`).click();
    await wait(40);
    rowOf(m.host, "use the default").querySelector<HTMLElement>("button")?.click();
    await wait(40);
    expect(r.calls["setSceneTracker"]).toEqual([
      ["c1", "inventory", { auto: { every: 9 } }],
      ["c1", "inventory", { auto: { on: false, every: 4 } }],
      ["c1", "inventory", { auto: null }],
    ]);
    m.done();
  });

  test("the Prop tooltips and TrackHare rows read and write their prefs", () => {
    const r = rig({ prefs: [["trackhare.sort", "az"]] });
    const env = { ctx: r.a.ctx, repaint: () => undefined };
    expect(TOOLTIPS_ROW.control === "toggle" && TOOLTIPS_ROW.read(env)).toBe(true);
    if (TOOLTIPS_ROW.control === "toggle") TOOLTIPS_ROW.write(env, false);
    expect(r.prefs.get("scenes.props.tooltips")).toBe(false);
    const row = (id: string) => HARE_ROWS.find((x) => x.id === id)!;
    expect(row("hare-group").control === "toggle" && (row("hare-group") as { read(e: typeof env): boolean }).read(env)).toBe(true);
    expect((row("hare-sort") as { read(e: typeof env): string }).read(env)).toBe("az");
    (row("hare-density") as { write(e: typeof env, v: string): void }).write(env, "compact");
    (row("hare-misses") as { write(e: typeof env, v: boolean): void }).write(env, false);
    (row("hare-sort") as { write(e: typeof env, v: string): void }).write(env, "nonsense");
    expect(r.prefs.get("trackhare.density")).toBe("compact");
    expect(r.prefs.get("trackhare.misses")).toBe(false);
    expect(r.prefs.get("trackhare.sort")).toBe("placement");
  });
});
