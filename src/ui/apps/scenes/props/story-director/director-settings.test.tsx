/**
 * The Story Director's Prop, its settings block, the Control Booth's Narrator section and the floating activity button, against a fake server: the registration (reach, tier, copy), only the
 * controls that work are drawn, each control sends its own patch, a refused write says so and keeps what was typed, the model row is a protected control, the Booth uses the Props wing's
 * switch, and the button hides until there is a line, counts the recent ones, opens the last ten and drags.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { sceneProps } from "../registry";
import { directorProp } from "./index";
import { DirectorBooth } from "./director-booth";
import { DirectorFab } from "./director-fab";
import { DirectorSettings } from "./director-settings";
import { takeDirectorTab } from "./director-live";
import { CHAT, fakeDirector, line, mounted, panelOf, story, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });
const chat = { ...CHAT, connection: { id: "c1", model: "claude" } } as Chat;
const text = (): string => m!.host.textContent ?? "";

async function settings(over: Parameters<typeof panelOf>[0] = {}): Promise<ReturnType<typeof fakeDirector>> {
  const rig = fakeDirector(panelOf(over));
  m = await mounted(dom, <DirectorSettings ctx={rig.ctx} chat={chat} />);
  return rig;
}

describe("the Prop", () => {
  test("it is registered as RoleCall's row: tier Story engine, reach model, its own panel, settings and stage button", () => {
    expect(sceneProps().find((p) => p.id === "story-director")).toBe(directorProp);
    expect(directorProp).toMatchObject({ name: "Story Director", tier: "Story engine", reach: "model", icon: "mdi:drama-masks" });
    expect(directorProp.panel?.id).toBe("director.panel");
    expect(directorProp.Sub).toBeDefined();
    expect(directorProp.Stage).toBeDefined();
    expect(directorProp.blurb).toContain("before each reply");
    expect(directorProp.blurb).not.toContain("after messages");
  });
});

describe("the settings block", () => {
  test("it draws the working controls with RoleCall's words, and none of the three that do nothing yet", async () => {
    await settings();
    for (const s of ["Sage", "The Balanced", "Story Director Model", "Reasoning", "Auto follows the model default.", "Story Director command mode", "Both modes use the same Director rules and state; only the command transport changes.", "Native tools available", "DM Temperature", "Creativity", "Auto-retry invalid tool responses", "Custom Instructions for DM", "Persistent, unlike the in-the-moment steering note.", "0/2000"]) expect(text()).toContain(s);
    for (const s of ["Interactive choices", "Refresh Enabled Boards"]) expect(text()).not.toContain(s);
    expect((m!.host.querySelector('input[aria-label="DM Temperature"]') as HTMLInputElement).value).toBe("0.7");
    expect(m!.host.querySelector('[data-protected="director-model"]')).not.toBeNull();
  });

  test("the capability badge and the no-tools line follow the model's tool support", async () => {
    await settings({ tools: "none" });
    expect(text()).toContain("Tagged recommended");
    expect(text()).toContain("This model reports no tool-calling support. The Story Director needs it and will fall back every turn.");
    m!.unmount();
    await settings({ tools: "unknown" });
    expect(text()).toContain("Tool support unknown");
    expect(text()).not.toContain("no tool-calling support");
  });

  test("the personality card opens a list of ten, and a pick sends it", async () => {
    const rig = await settings();
    await m!.click(m!.host.querySelector(".dp-card"));
    const options = [...m!.host.querySelectorAll('[role="option"]')];
    expect(options.length).toBe(10);
    expect(text()).toContain("Favorite Story Arcs");
    expect(text()).toContain("Emotional Focus");
    await m!.click(options[0]);
    expect(rig.patches).toEqual([{ personality: "the-weaver" }]);
    expect(text()).toContain("Meridian");
  });

  test("command mode, creativity and auto-retry each send their own patch", async () => {
    const rig = await settings();
    await m!.click(m!.host.querySelector('.ds-modes button:nth-child(2)'));
    await m!.click(m!.button("Dramatic"));
    await m!.click(m!.button("Disable auto-retry invalid tool responses"));
    expect(rig.patches).toEqual([{ commandMode: "tagged" }, { creativity: "dramatic" }, { autoRetry: false }]);
    expect(m!.host.querySelector('.ds-modes button.on')?.textContent).toContain("Tagged");
  });

  test("temperature is clamped to 0 to 2 when it loses focus", async () => {
    const rig = await settings();
    const input = m!.host.querySelector('input[aria-label="DM Temperature"]')!;
    await m!.type(input, "5");
    m!.flush(() => input.dispatchEvent(new dom.window.Event("focusout", { bubbles: true })));
    await m!.tick();
    expect(rig.patches).toEqual([{ temperature: 2 }]);
  });

  test("Custom Instructions save when they lose focus, are capped at 2000, and an empty box returns to the default", async () => {
    const rig = await settings({ settings: { ...panelOf().settings, instructions: "Keep it warm." } });
    const box = m!.host.querySelector("textarea")!;
    expect(box.getAttribute("maxlength")).toBe("2000");
    await m!.type(box, "Keep it warm and grounded.");
    expect(text()).toContain("26/2000");
    m!.flush(() => box.dispatchEvent(new dom.window.Event("focusout", { bubbles: true })));
    await m!.tick();
    expect(rig.patches).toEqual([{ instructions: "Keep it warm and grounded." }]);
    await m!.type(box, "");
    m!.flush(() => box.dispatchEvent(new dom.window.Event("focusout", { bubbles: true })));
    await m!.tick();
    expect(rig.patches.at(-1)).toEqual({ instructions: null });
  });

  test("a model pick sends the model; Use the narrator's model clears it and its reasoning", async () => {
    const rig = await settings();
    expect(text()).toContain("Unset: the Director uses the narrator's model.");
    await m!.click(m!.host.querySelector(".bth-pick"));
    await m!.click([...m!.host.querySelectorAll(".bth-opt")].find((o) => o.textContent?.includes("haiku")));
    expect(rig.patches).toEqual([{ model: { id: "c1", model: "haiku" } }]);
    await m!.click(m!.button("Use the narrator's model"));
    expect(rig.patches.at(-1)).toEqual({ model: null, reasoning: null });
    await m!.click(m!.button("High"));
    expect(rig.patches.at(-1)).toEqual({ reasoning: "high" });
  });

  test("a refused write says so, and a load that fails offers to try again", async () => {
    const rig = await settings();
    rig.failNext = true;
    await m!.click(m!.button("Subtle"));
    expect(text()).toContain("Story Director could not be updated.");
    m!.unmount();
    const bad = fakeDirector(panelOf());
    bad.ctx.api.getSceneDirector = async () => { throw new Error("no such scene"); };
    m = await mounted(dom, <DirectorSettings ctx={bad.ctx} chat={chat} />);
    expect(text()).toContain("no such scene");
    expect(m.button("Try again")).toBeDefined();
  });
});

describe("the Control Booth", () => {
  test("the Narrator section's switch adds the Prop; on, it shows the personality and the model", async () => {
    const rig = fakeDirector(panelOf({ on: false }));
    let told = 0;
    m = await mounted(dom, <DirectorBooth ctx={rig.ctx} chat={chat} busy={false} onProps={() => { told++; }} />);
    expect(text()).toContain("Narrator");
    expect(text()).toContain("Scene direction and narrator context");
    expect(text()).not.toContain("Story Director Model");
    await m!.click(m!.button("Turn on the Story Director"));
    expect(rig.props).toEqual([["story-director"]]);
    expect(told).toBe(1);
    expect(text()).toContain("Story Director Model");
    expect(text()).toContain("Sage");
    expect(m!.host.querySelector('[data-protected="director-model"]')).not.toBeNull();
    for (const t of ["DM Temperature", "Auto-retry invalid tool responses"]) expect(text()).toContain(t);
    expect(m!.host.querySelector('[data-part="scene.booth.narrator.runtime"]')).not.toBeNull();
  });

  test("turning it off removes only the Director from the Props, and the switch waits for a reply that is being written", async () => {
    const rig = fakeDirector(panelOf());
    m = await mounted(dom, <DirectorBooth ctx={rig.ctx} chat={chat} busy={false} onProps={() => undefined} />);
    await m!.click(m!.button("Turn off the Story Director"));
    expect(rig.props).toEqual([[]]);
    m!.unmount();
    m = await mounted(dom, <DirectorBooth ctx={rig.ctx} chat={chat} busy onProps={() => undefined} />);
    expect(m!.button("Turn on the Story Director")?.disabled).toBe(true);
  });
});

describe("the floating button", () => {
  test("it is not drawn until the Director has logged something", async () => {
    const rig = fakeDirector(panelOf());
    m = await mounted(dom, <div><DirectorFab ctx={rig.ctx} chat={chat} /></div>);
    expect(m!.host.querySelector('[data-part="scene.director.fab"]')).toBeNull();
  });

  test("it counts the last five minutes, pulses on a fresh line, and opens the last ten with the newest first", async () => {
    const now = Date.now();
    const many = Array.from({ length: 12 }, (_, i) => line(`e${i}`, "arc", now - (12 - i) * 1000, { description: `entry ${i}` }));
    const rig = fakeDirector(panelOf({ state: story({ activity: [line("old", "arc", now - 10 * 60_000), ...many] }) }));
    m = await mounted(dom, <div><DirectorFab ctx={rig.ctx} chat={chat} /></div>);
    expect(m!.host.querySelector('[data-part="scene.director.fab.badge"]')?.textContent).toBe("12");
    const button = m!.host.querySelector('[data-part="scene.director.fab.button"]')!;
    expect(button.className).toContain("pulse");
    expect(button.getAttribute("title")).toBe("DM: Arc");
    await m!.click(button);
    const lines = [...m!.host.querySelectorAll('[data-part="scene.director.fab.popover"] .dr-act')];
    expect(lines.length).toBe(10);
    expect(lines[0]!.textContent).toContain("entry 11");
    expect(text()).toContain("Story Director Activity");
  });

  test("View All Activity opens the panel on its Activity tab", async () => {
    const rig = fakeDirector(panelOf({ state: story() }));
    m = await mounted(dom, <div><DirectorFab ctx={rig.ctx} chat={chat} /></div>);
    await m!.click(m!.host.querySelector('[data-part="scene.director.fab.button"]'));
    await m!.click(m!.button("View All Activity ->"));
    expect(takeDirectorTab(chat.id)).toBe("activity");
    expect(JSON.stringify(rig.prefs["popout.director.panel"])).toContain("true");
  });

  test("an old line does not pulse, and the popover says when the last minutes were quiet", async () => {
    const rig = fakeDirector(panelOf({ state: story({ activity: [line("old", "arc", Date.now() - 20 * 60_000)] }) }));
    m = await mounted(dom, <div><DirectorFab ctx={rig.ctx} chat={chat} /></div>);
    const button = m!.host.querySelector('[data-part="scene.director.fab.button"]')!;
    expect(button.className).not.toContain("pulse");
    expect(button.getAttribute("title")).toBe("Story Director Activity");
    expect(m!.host.querySelector('[data-part="scene.director.fab.badge"]')).toBeNull();
  });

  test("dragging it moves it and remembers the place; a drag is not a click", async () => {
    const rig = fakeDirector(panelOf({ state: story() }));
    m = await mounted(dom, <div style={{ position: "relative" }}><DirectorFab ctx={rig.ctx} chat={chat} /></div>);
    const button = m!.host.querySelector('[data-part="scene.director.fab.button"]')!;
    const fire = (type: string, x: number, y: number): void => { const e = new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }); Object.assign(e, { pointerId: 1, pointerType: "mouse" }); m!.flush(() => button.dispatchEvent(e)); };
    fire("pointerdown", 100, 100);
    fire("pointermove", 130, 140);
    fire("pointerup", 130, 140);
    await m!.tick();
    expect(rig.prefs["scenes.director.fab"]).toBeDefined();
    await m!.click(button);
    expect(m!.host.querySelector('[data-part="scene.director.fab.popover"]')).toBeNull();
    await m!.click(button);
    expect(m!.host.querySelector('[data-part="scene.director.fab.popover"]')).not.toBeNull();
  });
});
