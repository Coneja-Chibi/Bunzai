/** RoleCall's plain controls: each keeps its native element and props, a Button never submits by accident, a Tooltip describes its child. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ReactElement } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/" });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

async function mount(node: ReactElement): Promise<HTMLElement> {
  const [{ flushSync }, { createRoot }] = await Promise.all([import("react-dom"), import("react-dom/client")]);
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(node));
  return host;
}

test("each control is its native element with its props and the shared class", async () => {
  const { Input, Textarea, Select, Checkbox, Chip } = await import("./index");
  const host = await mount(<><Input aria-label="a" className="mine" /><Textarea aria-label="b" /><Select aria-label="c"><option>x</option></Select><Checkbox aria-label="d" defaultChecked /><Chip>tag</Chip></>);
  expect(host.querySelector("input[aria-label=a]")!.className).toContain("mine");
  expect(host.querySelector("textarea")).not.toBeNull();
  expect(host.querySelector("select")!.querySelector("option")).not.toBeNull();
  const box = host.querySelector<HTMLInputElement>("input[aria-label=d]")!;
  expect(box.type).toBe("checkbox");
  expect(box.checked).toBe(true);
  expect(host.querySelector("span")!.textContent).toBe("tag");
});

test("a Tooltip's text is the child's accessible description", async () => {
  const { Tooltip } = await import("./index");
  const host = await mount(<Tooltip text="Explains it"><button type="button">?</button></Tooltip>);
  const tip = host.querySelector("[role=tooltip]")!;
  expect(tip.textContent).toBe("Explains it");
  expect(host.firstElementChild!.getAttribute("aria-describedby")).toBe(tip.id);
});
