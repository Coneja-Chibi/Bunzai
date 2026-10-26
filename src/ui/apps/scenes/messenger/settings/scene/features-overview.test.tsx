/** The Overview, Features, Story Director, Pictures and character pages are rows: stored values read, writes reach the existing writer, tools are drill rows, no Prop or card panel is drawn inside. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import type { SceneProp } from "../../../props/prop-contract";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { characterScope } from "../character-scope";
import { directorCategory } from "./director";
import { featuresCategories } from "./features";
import { overviewCategory } from "./overview";
import { picturesCategory } from "./pictures";
import { bodyOfSection, control, none, rig, rowOf, setValue, wait } from "./fake-scene-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8412); });
afterAll(async () => { await teardownAllDoms(); });

const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const NO_PANELS = ["props.story-director.settings", "scene.props", "scene.cast.character", "scene.cast.persona", "scene.backdrop.row", "scene.messenger.settings.tool", "scene.messenger.settings.studio"];
const prop = (id: string, name: string, extra: Partial<SceneProp> = {}): SceneProp => ({ id, name, reach: "none", blurb: `${name} blurb`, tier: "t", icon: "lucide:star", tone: "var(--x)", ...extra }) as SceneProp;

describe("Overview page", () => {
  test("the title reads the scene's, saves a changed one once it rests and never an empty one; persona and backdrop are drills", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(overviewCategory(r.a, r.open), "scene"));
    const title = control<HTMLTextAreaElement>(m.host, "Title");
    expect(title.value).toBe("The flooded archive");
    setValue(title, "The sunken archive");
    await wait(550);
    expect(r.calls["renameScene"]).toEqual([["c1", "The sunken archive"]]);
    setValue(title, "   ");
    await wait(550);
    expect(r.calls["renameScene"]).toHaveLength(1);
    expect(rowOf(m.host, "Playing as").textContent).toContain("Mina Okafor");
    rowOf(m.host, "Playing as").click();
    rowOf(m.host, "Backdrop").click();
    expect(r.opened).toEqual(["persona", "display"]);
    none(m.host, ...NO_PANELS);
    m.done();
  });
});

describe("Features pages", () => {
  const list = [prop("story-director", "Story Director", { panel: "p" as never }), prop("plain", "Plain"), prop("mood-music", "Mood Music", { panel: "m" as never })];

  test("one switch per Prop reads the page's Props state and writes through it", async () => {
    const r = rig({ registeredProps: list, propsOn: ["plain"] });
    const m = await mount(bodyOfSection(featuresCategories(r.a, r.open)[0]!, "features"));
    expect(control<HTMLElement>(m.host, "Plain").getAttribute("aria-checked")).toBe("true");
    expect(control<HTMLElement>(m.host, "Story Director").getAttribute("aria-checked")).toBe("false");
    control<HTMLElement>(m.host, "Story Director").click();
    await wait(10);
    expect(r.props.toggled).toEqual([["story-director", true]]);
    none(m.host, ...NO_PANELS);
    m.done();
  });

  test("a Prop with a panel gets a page while it is on; the Story Director's has its own rows, any other is a drill", async () => {
    const r = rig({ registeredProps: list, propsOn: ["story-director", "mood-music"] });
    const cats = featuresCategories(r.a, r.open);
    expect(cats.map((c) => c.id)).toEqual(["features", "prop-story-director", "prop-mood-music"]);
    const m = await mount(bodyOfSection(cats[2]!, "prop-mood-music"));
    rowOf(m.host, "Open Mood Music").click();
    expect(r.opened).toEqual(["prop-mood-music"]);
    m.done();
  });
});

describe("Story Director page", () => {
  test("each setting reads the saved value and writes the one settings patch", async () => {
    const r = rig();
    const cat = directorCategory(r.a, r.open);
    const runtime = await mount(bodyOfSection(cat, "director-runtime"));
    await wait(40);
    expect(control<HTMLElement>(runtime.host, "Auto-retry invalid tool responses").getAttribute("aria-checked")).toBe("true");
    control<HTMLElement>(runtime.host, "Auto-retry invalid tool responses").click();
    await wait(40);
    setValue(control<HTMLInputElement>(runtime.host, "Every N replies"), "7");
    await wait(550);
    expect(r.calls["setSceneDirectorSettings"]).toEqual([["c1", { autoRetry: false }], ["c1", { every: 7 }]]);
    none(runtime.host, ...NO_PANELS);
    runtime.done();
    const rules = await mount(bodyOfSection(cat, "director-rules"));
    await wait(40);
    setValue(control<HTMLTextAreaElement>(rules.host, "House rules"), "No time travel.");
    await wait(550);
    expect(r.calls["setSceneDirectorSettings"]?.at(-1)).toEqual(["c1", { instructions: "No time travel." }]);
    rules.done();
  });

  test("personality and creativity are choices that write; the model and the panel are drills", async () => {
    const r = rig();
    const cat = directorCategory(r.a, r.open);
    const style = await mount(bodyOfSection(cat, "director-style"));
    await wait(40);
    const creative = [...style.host.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Dramatic");
    creative?.click();
    await wait(40);
    expect(r.calls["setSceneDirectorSettings"]).toEqual([["c1", { creativity: "dramatic" }]]);
    style.done();
    const model = await mount(bodyOfSection(cat, "director-model"));
    await wait(40);
    rowOf(model.host, "Story Director model").click();
    expect(r.opened).toEqual(["prop-story-director"]);
    model.done();
  });
});

describe("Pictures page", () => {
  test("overlay darkness reads the backdrop and saves it as the backdrop picker does", async () => {
    const r = rig({ chat: { backdrop: { pack: "p1", item: "i1", dim: 0.4 } } as never });
    const m = await mount(bodyOfSection(picturesCategory(r.a, r.open), "backdrop"));
    await wait(30);
    const slider = control<HTMLInputElement>(m.host, "Overlay darkness");
    expect(slider.value).toBe("40");
    setValue(slider, "70");
    await wait(550);
    expect(r.calls["setSceneBackdrop"]).toEqual([["c1", { pack: "p1", item: "i1", dim: 0.7 }]]);
    rowOf(m.host, "Backdrop").click();
    expect(r.opened).toEqual(["display"]);
    m.done();
  });

  test("no overlay row without a backdrop", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(picturesCategory(r.a, r.open), "backdrop"));
    await wait(30);
    expect(m.host.querySelector('[aria-label="Overlay darkness"]')).toBeNull();
    m.done();
  });
});

describe("Character page", () => {
  test("the card fields are value rows that lead to the Characters program and write nothing", async () => {
    const r = rig();
    const scope = characterScope(r.a, r.open);
    expect(scope.categories.map((c) => c.id)).toEqual(["overview", "defaults"]);
    const m = await mount(bodyOfSection(scope.categories[0]!, "card"));
    expect(rowOf(m.host, "Name").textContent).toContain("Vera");
    expect(rowOf(m.host, "Content rating").textContent).toContain("Late Night");
    expect(rowOf(m.host, "Tags").textContent).toContain("river, maps");
    rowOf(m.host, "Description").querySelector<HTMLElement>("button")?.click();
    scope.edit?.onClick();
    expect(r.opened).toEqual(["characters", "characters"]);
    expect(Object.keys(r.calls)).toEqual([]);
    none(m.host, ...NO_PANELS);
    m.done();
  });

  test("the Look writes the scene's variant", async () => {
    const r = rig();
    const m = await mount(bodyOfSection(characterScope(r.a, r.open).categories[0]!, "card"));
    setValue(control<HTMLSelectElement>(m.host, "Look"), "v1");
    await wait(30);
    expect(r.calls["editScene"]).toEqual([["variant", { chatId: "c1", variantId: "v1" }]]);
    m.done();
  });

  test("an update is offered only when the library has a newer card, and the full editor opens the Workbench", async () => {
    const r = rig({ card: { name: "Vera", version: 3, latest: 4, previous: 2 } });
    const m = await mount(bodyOfSection(characterScope(r.a, r.open).categories[0]!, "version"));
    rowOf(m.host, "Update available").querySelector<HTMLElement>("button")?.click();
    rowOf(m.host, "Previous version").querySelector<HTMLElement>("button")?.click();
    rowOf(m.host, "Full editor").querySelector<HTMLElement>("button")?.click();
    expect(r.calls["onUpdate"]).toHaveLength(1);
    expect(r.calls["onRevert"]).toHaveLength(1);
    expect(r.calls["workbench.open"]).toEqual([[{ id: "ch1", kind: "character", name: "Vera" }]]);
    m.done();
    const same = rig({ card: { name: "Vera", version: 3, latest: 3, previous: null } });
    const n = await mount(bodyOfSection(characterScope(same.a, same.open).categories[0]!, "version"));
    expect(n.host.textContent).not.toContain("Update available");
    n.done();
  });
});
