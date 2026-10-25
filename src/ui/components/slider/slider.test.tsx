/**
 * The shared slider, mounted: the range commits on every change (so a keyboard step lands), the sampler card's
 * readout types a value (Enter and blur commit once, Escape cancels, clamped and snapped), "?" opens the help.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { SliderProps } from "./index";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event", "KeyboardEvent", "HTMLInputElement"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

interface Mounted { host: HTMLElement; calls: number[]; done(): void; flush(fn: () => void): void }
async function mount(props: Partial<SliderProps> = {}): Promise<Mounted> {
  const [{ flushSync }, { createRoot }, { Slider }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./index")]);
  const calls: number[] = [];
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<Slider min={0} max={2} step={0.05} value={0.7} onChange={(v) => calls.push(v)} aria-label="Temperature" {...props} />));
  return { host, calls, flush: (fn) => flushSync(fn), done: () => { flushSync(() => root.unmount()); host.remove(); } };
}
const range = (m: Mounted): HTMLInputElement => m.host.querySelector<HTMLInputElement>("input[type=range]")!;
const typed = (m: Mounted): HTMLInputElement => m.host.querySelector<HTMLInputElement>("input[type=number]")!;
const readout = (m: Mounted): HTMLButtonElement => m.host.querySelector<HTMLButtonElement>("button[title='Click to type a value']")!;
const type = (m: Mounted, input: HTMLInputElement, text: string): void => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, text);
  m.flush(() => input.dispatchEvent(new dom.window.Event("input", { bubbles: true })));
};
const key = (m: Mounted, el: Element, k: string): void => m.flush(() => el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true })));
const blur = (m: Mounted, el: Element): void => m.flush(() => el.dispatchEvent(new dom.window.Event("focusout", { bubbles: true })));

describe("the range", () => {
  test("a change commits the new number at once and the fill follows the value", async () => {
    const m = await mount();
    expect(range(m).style.getPropertyValue("--slider-p")).toBe("35%");
    type(m, range(m), "1.25");
    expect(m.calls).toEqual([1.25]);
    m.done();
  });
  test("it stays a real range input carrying the aria-label, disabled and id", async () => {
    const m = await mount({ disabled: true, id: "r1" });
    expect(range(m).getAttribute("aria-label")).toBe("Temperature");
    expect(range(m).disabled).toBe(true);
    expect(range(m).id).toBe("r1");
    m.done();
  });
  test("readout false and no label is the bare range alone", async () => {
    const m = await mount({ readout: false });
    expect(m.host.children.length).toBe(1);
    expect(m.host.firstElementChild?.tagName).toBe("INPUT");
    m.done();
  });
  test("uncontrolled, it paints its own fill without a re-render", async () => {
    const m = await mount({ value: undefined, defaultValue: 0, readout: false });
    type(m, range(m), "1");
    expect(range(m).style.getPropertyValue("--slider-p")).toBe("50%");
    m.done();
  });
});

describe("the sampler card", () => {
  test("shows the label and RoleCall's readout", async () => {
    const m = await mount({ label: "Temperature", value: 8192, max: 200000, step: 1 });
    expect(m.host.textContent).toContain("Temperature");
    expect(readout(m).textContent).toBe("8.2K");
    m.done();
  });
  test("click to type, Enter commits once, clamped to the range and snapped to the step", async () => {
    const m = await mount({ label: "Temperature" });
    m.flush(() => readout(m).click());
    const field = typed(m);
    type(m, field, "9.99");
    key(m, field, "Enter");
    blur(m, field);
    expect(m.calls).toEqual([2]);
    expect(typed(m)).toBeNull();
    m.done();
  });
  test("Escape cancels: nothing is committed, not even by the blur that follows", async () => {
    const m = await mount({ label: "Temperature" });
    m.flush(() => readout(m).click());
    const field = typed(m);
    type(m, field, "1.5");
    key(m, field, "Escape");
    blur(m, field);
    expect(m.calls).toEqual([]);
    expect(readout(m).textContent).toBe("0.70");
    m.done();
  });
  test("blur commits what was typed, snapped to the step", async () => {
    const m = await mount({ label: "Temperature" });
    m.flush(() => readout(m).click());
    type(m, typed(m), "0.333");
    blur(m, typed(m));
    expect(m.calls).toEqual([0.35]);
    m.done();
  });
  test("an empty or unreadable entry commits nothing", async () => {
    const m = await mount({ label: "Temperature" });
    m.flush(() => readout(m).click());
    type(m, typed(m), "");
    key(m, typed(m), "Enter");
    expect(m.calls).toEqual([]);
    m.done();
  });
  test("a disabled card cannot be typed into", async () => {
    const m = await mount({ label: "Temperature", disabled: true });
    expect(readout(m)).toBeNull();
    expect(m.host.querySelector("[data-disabled]")).not.toBeNull();
    m.done();
  });
  test("the ? opens and closes the help text", async () => {
    const m = await mount({ label: "Temperature", help: "How wild the model gets." });
    const toggle = m.host.querySelector<HTMLButtonElement>("button[aria-label='About Temperature']")!;
    expect(m.host.textContent).not.toContain("How wild");
    m.flush(() => toggle.click());
    expect(m.host.textContent).toContain("How wild the model gets.");
    m.flush(() => toggle.click());
    expect(m.host.textContent).not.toContain("How wild");
    m.done();
  });
});
