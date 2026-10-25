/** The Stage wing's Chat Accent Color row: it offers a source only when that source has a colour, and writes the pick to the preferences. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { ACCENT_CUSTOM_KEY, ACCENT_SOURCE_KEY, type PieceColors } from "./scene-accent-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

async function mount(pref: Record<string, unknown>, colors: PieceColors): Promise<{ host: HTMLElement; sets: [string, unknown][]; done(): void }> {
  const [{ flushSync }, { createRoot }, { StageWing }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./scene-stage-wing")]);
  const sets: [string, unknown][] = [];
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<StageWing prefs={{ get: (k) => pref[k] }} colors={colors} onSet={(k, v) => sets.push([k, v])} />));
  return { host, sets, done: () => flushSync(() => root.unmount()) };
}
const chip = (host: HTMLElement, name: string): HTMLButtonElement => [...host.querySelectorAll<HTMLButtonElement>(".pg-chip")].find((b) => b.textContent === name)!;

describe("Stage wing: Chat Accent Color", () => {
  test("a source with no colour is disabled; the others are offered, and the pick is written to the preferences", async () => {
    const { host, sets, done } = await mount({}, { character: "#008080" });
    expect(chip(host, "Character").getAttribute("aria-pressed")).toBe("true");
    expect(chip(host, "Persona").disabled).toBe(true);
    expect(chip(host, "Profile").disabled).toBe(false);
    chip(host, "Profile").click();
    chip(host, "Custom").click();
    expect(sets).toEqual([[ACCENT_SOURCE_KEY, "profile"], [ACCENT_SOURCE_KEY, "custom"]]);
    done();
  });
  test("Custom opens the colour picker, and a persona with a colour can be picked", async () => {
    const { host, sets, done } = await mount({ [ACCENT_SOURCE_KEY]: "custom", [ACCENT_CUSTOM_KEY]: "#ff0000" }, { persona: "#06b6d4" });
    const swatch = host.querySelector<HTMLButtonElement>('.pg-card button[title="Custom color"]')!;
    expect(host.querySelector(".pg-card input")).toBeNull();
    const { flushSync } = await import("react-dom");
    flushSync(() => swatch.click());
    expect(host.querySelector(".pg-card input")).not.toBeNull();
    expect(chip(host, "Character").disabled).toBe(true);
    chip(host, "Persona").click();
    expect(sets).toEqual([[ACCENT_SOURCE_KEY, "persona"]]);
    done();
  });
  test("with no scene open the row is absent", async () => {
    const [{ flushSync }, { createRoot }, { StageWing }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./scene-stage-wing")]);
    const host = dom.window.document.createElement("div");
    const root = createRoot(host);
    flushSync(() => root.render(<StageWing prefs={{ get: () => undefined }} onSet={() => undefined} />));
    expect(host.querySelector(".pg-chip")).toBeNull();
    flushSync(() => root.unmount());
  });
});
