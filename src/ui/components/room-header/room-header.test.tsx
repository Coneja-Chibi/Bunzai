/**
 * The room header and panel contracts: the header renders its kicker, title, lede and actions with their slots and the
 * room's data-part, digits in a title leave the display face, and a Panel carries its deck and data-part.
 */
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

test("RoomHeader renders its slots, the room's data-part and its actions", async () => {
  const { RoomHeader } = await import("./index");
  const host = await mount(<RoomHeader kicker="Convert files" title="The Press" lede="One bundle out." actions={<button type="button">Go</button>} data-part="press.header" />);
  const header = host.querySelector("header")!;
  expect(header.dataset.part).toBe("press.header");
  expect(header.dataset.align).toBe("left");
  expect(host.querySelector('[data-slot="kicker"]')!.textContent).toBe("Convert files");
  expect(host.querySelector("h1")!.textContent).toBe("The Press");
  expect(host.querySelector('[data-slot="lede"]')!.textContent).toBe("One bundle out.");
  expect(host.querySelector('[data-slot="actions"] button')!.textContent).toBe("Go");
});

test("digits in a string title are wrapped so the display face never draws them, and empty slots are absent", async () => {
  const { RoomHeader } = await import("./index");
  const host = await mount(<RoomHeader title="Replace 1 rule in 12 places" align="center" />);
  const title = host.querySelector("h1")!;
  expect(title.textContent).toBe("Replace 1 rule in 12 places");
  expect([...title.querySelectorAll("span")].map((s) => s.textContent)).toEqual(["1", "12"]);
  expect(host.querySelector('[data-slot="kicker"]')).toBeNull();
  expect(host.querySelector('[data-slot="actions"]')).toBeNull();
  expect(host.querySelector("header")!.dataset.align).toBe("center");
});

test("Panel carries its deck, data-part, element and extra attributes", async () => {
  const { Panel } = await import("../panel/index");
  const host = await mount(<Panel as="article" deck="lorebook" data-part="press.bundle" aria-label="Bundle"><p>x</p></Panel>);
  const el = host.querySelector("article")!;
  expect(el.dataset.control).toBe("panel");
  expect(el.dataset.deck).toBe("lorebook");
  expect(el.dataset.part).toBe("press.bundle");
  expect(el.getAttribute("aria-label")).toBe("Bundle");
});
