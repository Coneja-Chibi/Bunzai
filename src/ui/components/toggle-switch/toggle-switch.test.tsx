/** The shared switch, mounted: it flips on click, reports its state, honors disabled, and a row switch stays one button. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { ToggleSwitchProps } from "./index";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

async function mount(props: Partial<ToggleSwitchProps> = {}): Promise<{ host: HTMLElement; calls: boolean[]; done(): void; click(): void }> {
  const [{ flushSync }, { createRoot }, { ToggleSwitch }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./index")]);
  const calls: boolean[] = [];
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<ToggleSwitch on={false} onChange={(v) => calls.push(v)} aria-label="Use it" {...props} />));
  return { host, calls, click: () => flushSync(() => host.querySelector("button")!.click()), done: () => { flushSync(() => root.unmount()); host.remove(); } };
}

describe("ToggleSwitch", () => {
  test("is a switch that reports the opposite state on click", async () => {
    const m = await mount();
    const b = m.host.querySelector("button")!;
    expect(b.getAttribute("role")).toBe("switch");
    expect(b.getAttribute("aria-checked")).toBe("false");
    m.click();
    expect(m.calls).toEqual([true]);
    m.done();
    const on = await mount({ on: true });
    expect(on.host.querySelector("button")!.getAttribute("aria-checked")).toBe("true");
    on.click();
    expect(on.calls).toEqual([false]);
    on.done();
  });
  test("disabled does not fire", async () => {
    const m = await mount({ disabled: true });
    m.click();
    expect(m.calls).toEqual([]);
    m.done();
  });
  test("label and title land beside the track", async () => {
    const m = await mount({ label: "Remember", title: "Keep it", size: "sm" });
    expect(m.host.textContent).toBe("Remember");
    expect(m.host.querySelector("button")!.title).toBe("Keep it");
    m.done();
  });
  test("row content makes the switch one button with the track at its end", async () => {
    const m = await mount({ children: <span>Row text</span> });
    expect(m.host.querySelectorAll("button").length).toBe(1);
    expect(m.host.querySelector("button")!.firstElementChild?.textContent).toBe("Row text");
    m.done();
  });
  test("tone re-colors the on state through --toggle-on", async () => {
    const m = await mount({ tone: "var(--tone)" });
    expect(m.host.querySelector<HTMLElement>("button")!.style.getPropertyValue("--toggle-on")).toBe("var(--tone)");
    m.done();
  });
});
