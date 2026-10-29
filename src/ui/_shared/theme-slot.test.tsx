/** ThemeSlot: slot content is data drawn as text and digest-served images; hostile or off-shape payloads draw nothing. */
import { afterAll, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { installDom } from "./test-dom";
import { ThemeSlot } from "./theme-slot";
import { SLOT_ATTRIBUTE, SLOT_IDS } from "./theme-slot-core";

const installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true }, extraGlobals: ["MutationObserver"] });
afterAll(() => installed.teardown());

const logo = `/api/themes/assets/bunzai.theme.encore/logo?digest=${"a".repeat(64)}`;

async function draw(payload: object | string | null, id: (typeof SLOT_IDS)[number] = "library.header"): Promise<HTMLElement> {
  const root = document.documentElement;
  if (payload === null) root.removeAttribute(SLOT_ATTRIBUTE);
  else root.setAttribute(SLOT_ATTRIBUTE, typeof payload === "string" ? payload : JSON.stringify(payload));
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host).render(createElement(ThemeSlot, { id })); });
  return host;
}

test("text is drawn as text, never parsed as HTML", async () => {
  const hostile = '<img src=x onerror="globalThis.pwned=1"><b>bold</b>';
  const host = await draw({ slots: { "library.header": [{ kind: "text", text: hostile }] }, assets: {}, classes: [] });
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("b")).toBeNull();
  expect(host.textContent).toBe(hostile);
});

test("no payload, a bad payload or an empty slot draws no node", async () => {
  expect((await draw(null)).innerHTML).toBe("");
  expect((await draw("{not json")).innerHTML).toBe("");
  expect((await draw({ slots: { "library.empty": [{ kind: "text", text: "x" }] }, assets: {}, classes: [] }, "library.header")).innerHTML).toBe("");
});

test("an image is drawn from the digest URL with its alt text", async () => {
  const host = await draw({ slots: { "library.header": [{ kind: "image", asset: "logo", alt: "Encore" }] }, assets: { logo }, classes: [] });
  expect(host.querySelector("img")?.getAttribute("src")).toBe(logo);
  expect(host.querySelector("img")?.getAttribute("alt")).toBe("Encore");
});

test("the wrapper carries the slot's part name so a theme can style it", async () => {
  const host = await draw({ slots: { "shell.nav.end": [{ kind: "text", text: "hi" }] }, assets: {}, classes: [] }, "shell.nav.end");
  expect(host.querySelector('[data-part="slot.shell.nav.end"]')?.textContent).toBe("hi");
});

test("every slot id has a host placement in the UI, so a theme never fills a slot that nothing draws", async () => {
  const glob = new Bun.Glob("**/*.tsx");
  const used = new Set<string>();
  for await (const path of glob.scan({ cwd: `${import.meta.dir}/..` })) {
    if (path.endsWith(".test.tsx")) continue;
    for (const match of (await Bun.file(`${import.meta.dir}/../${path}`).text()).matchAll(/<ThemeSlot id="([a-z.]+)"/g)) used.add(match[1]!);
  }
  expect([...used].sort()).toEqual([...SLOT_IDS].sort());
});

test("every wing has a slot, and every tab a wing opens has one, named scene.wing.<wing>[.<tab>]", async () => {
  const { WINGS } = await import("../apps/scenes/scene-wings");
  for (const w of WINGS) expect(SLOT_IDS as readonly string[], w.id).toContain(`scene.wing.${w.id}`);
  const tabs: Record<string, string[]> = {
    cast: ["character", "persona", "participants"], prompting: ["preset", "guides", "note", "tools"], world: ["lorebook", "compendium"],
    finalcut: ["cut", "regex"], ai: ["model", "generation"], stage: ["appearance", "gallery", "music", "spotify", "wardrobe"], context: ["inspector", "memory"],
  };
  for (const [wing, list] of Object.entries(tabs)) for (const tab of list) expect(SLOT_IDS as readonly string[], `${wing}.${tab}`).toContain(`scene.wing.${wing}.${tab}`);
  expect(SLOT_IDS.filter((id) => id.startsWith("scene.wing.")).length).toBe(WINGS.length + Object.values(tabs).flat().length);
});
