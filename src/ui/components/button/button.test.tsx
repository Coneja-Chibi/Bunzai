/**
 * The button family's public contract: every part is a real <button> that never submits by accident, carries its
 * data-part, and exposes its state to assistive tech; Segmented and Tabs report choices; Tabs move with arrow keys;
 * IconButton always has a spoken name.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ReactElement } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["KeyboardEvent", "MouseEvent", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

async function mount(node: ReactElement): Promise<{ host: HTMLElement; rerender: (n: ReactElement) => void }> {
  const [{ flushSync }, { createRoot }] = await Promise.all([import("react-dom"), import("react-dom/client")]);
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(node));
  return { host, rerender: (n) => flushSync(() => root.render(n)) };
}
const settle = async (): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => undefined); };

test("Button is type=button by default, keeps submit, disabled and data-part, and calls onClick", async () => {
  const { Button } = await import("./index");
  let clicks = 0;
  const { host } = await mount(<><Button data-part="x.go" onClick={() => clicks++}>Go</Button><Button type="submit" variant="danger" size="sm" disabled>Send</Button></>);
  const [a, b] = [...host.querySelectorAll("button")];
  expect(a!.type).toBe("button");
  expect(a!.dataset.part).toBe("x.go");
  a!.click();
  expect(clicks).toBe(1);
  expect(b!.type).toBe("submit");
  expect(b!.disabled).toBe(true);
});

test("IconButton always has a spoken name and a tooltip", async () => {
  const { IconButton } = await import("./index");
  const { host } = await mount(<IconButton label="Close preview" icon="lucide:x" />);
  const button = host.querySelector("button")!;
  expect(button.getAttribute("aria-label")).toBe("Close preview");
  expect(button.title).toBe("Close preview");
  expect(button.textContent).toBe("");
});

test("Segmented reports one choice, or toggles several with multiple", async () => {
  const { Segmented } = await import("./index");
  const items = [{ value: "desk", label: "Desk" }, { value: "nodes", label: "Nodes" }] as const;
  const seen: unknown[] = [];
  const { host } = await mount(<><Segmented label="View" items={items} value="desk" onChange={(v) => seen.push(v)} /><Segmented multiple label="Layers" items={items} value={["desk"]} onChange={(v) => seen.push(v)} /></>);
  const [one, many] = [...host.querySelectorAll("[role=group]")];
  expect(one!.getAttribute("aria-label")).toBe("View");
  expect([...one!.querySelectorAll("button")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
  (one!.querySelectorAll("button")[1] as HTMLButtonElement).click();
  (many!.querySelectorAll("button")[0] as HTMLButtonElement).click();
  (many!.querySelectorAll("button")[1] as HTMLButtonElement).click();
  expect(seen).toEqual(["nodes", [], ["desk", "nodes"]]);
});

test("Tabs mark the selected tab, keep one tab stop, and move with arrow keys", async () => {
  const { Tabs } = await import("./index");
  const items = [{ value: "a", label: "Appearance" }, { value: "m", label: "Models" }, { value: "s", label: "Security" }] as const;
  let value = "a" as "a" | "m" | "s";
  const render = (): ReactElement => <Tabs label="Settings" items={items} value={value} onChange={(v) => { value = v; }} />;
  const { host, rerender } = await mount(render());
  const tabs = (): HTMLButtonElement[] => [...host.querySelectorAll<HTMLButtonElement>("[role=tab]")];
  expect(host.querySelector("[role=tablist]")!.getAttribute("aria-label")).toBe("Settings");
  expect(tabs().map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
  expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  tabs()[0]!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  await settle();
  expect(value).toBe("s");
  rerender(render());
  tabs()[2]!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  expect(value).toBe("a");
});

test("Chip exposes its on/off state only when it has one", async () => {
  const { Chip } = await import("./index");
  const { host } = await mount(<><Chip pressed color="var(--deck-character)">Links</Chip><Chip>Has art</Chip></>);
  const [on, plain] = [...host.querySelectorAll("button")];
  expect(on!.getAttribute("aria-pressed")).toBe("true");
  expect(on!.querySelector("i[aria-hidden=true]")).not.toBeNull();
  expect(plain!.hasAttribute("aria-pressed")).toBe(false);
});
test("a tone marks Button and Chip and carries the color as --tone; no tone leaves neither", async () => {
  const { Button, Chip } = await import("./index");
  const { host } = await mount(<><Button tone="var(--stage-warn)">Fix</Button><Chip tone="var(--accent)">New</Chip><Chip>Plain</Chip></>);
  const [b, c, plain] = [...host.querySelectorAll("button")];
  expect(b!.hasAttribute("data-tone")).toBe(true);
  expect(b!.style.getPropertyValue("--tone")).toBe("var(--stage-warn)");
  expect(c!.style.getPropertyValue("--tone")).toBe("var(--accent)");
  expect(plain!.hasAttribute("data-tone")).toBe(false);
  expect(plain!.style.getPropertyValue("--tone")).toBe("");
});
test("IconButton takes a tone the same way", async () => {
  const { IconButton } = await import("./index");
  const { host } = await mount(<IconButton variant="quiet" tone="var(--stage-ok)" label="Copied" icon="lucide:check" />);
  const b = host.querySelector("button")!;
  expect(b.hasAttribute("data-tone")).toBe(true);
  expect(b.style.getPropertyValue("--tone")).toBe("var(--stage-ok)");
});
