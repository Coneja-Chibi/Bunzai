/**
 * The Booth's model button and dropdown (RoleCall QuickPlayPanel.tsx:1709-1904): the button names the model by its display name over its provider and window, the
 * dropdown lists display names under one head per connection with the provider chips counting what each holds, a search narrows by name or id, and a pick closes it.
 * The cap (16rem), the sticky heads and the 40px tile are CSS (booth-style.ts), seen in the live pass.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ChatConnection } from "../../../stage/contracts/chat-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { SceneModels } from "./use-scene-models";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8342/", pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const models = {
  conns: [{ id: "k1", label: "Harbor", kind: "openai", model: "m" }, { id: "k2", label: "Cove", kind: "openai", model: "m", unavailable: "No key saved" }],
  models: { k1: { state: "ready", ids: [{ id: "claude-x-1", label: "Claude X One", context: 200_000 }, { id: "plain-2" }], saved: "claude-x-1" } },
  favorites: [],
  labelOf: (id: string) => (id === "k1" ? "Harbor" : "Cove"),
  windowOf: () => 200_000,
  nameOf: (c: ChatConnection) => (c.model === "claude-x-1" ? "Claude X One" : c.model),
  toggleFavorite: () => undefined, retry: () => undefined, pick: () => undefined,
} as unknown as SceneModels;

async function mount(onPick: (c: ChatConnection) => void) {
  const { BoothModelPicker } = await import("./booth-model-picker");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<BoothModelPicker current={{ id: "k1", model: "claude-x-1" }} models={models} onPick={onPick} />); });
  return { host, done: () => { act(() => root.unmount()); host.remove(); } };
}

const TRIGGER = '.bth-pickwrap > [data-control="row"]';
const OPTIONS = '.bth-dlist [data-control="row"]';
/** The first line of a ListRow (its title), without the second line. */
const titleOf = (row: Element): string | null => row.querySelector("small")!.previousElementSibling!.textContent;

describe("the Booth model picker", () => {
  test("the button shows the display name, its provider and window; opening lists display names under a head per connection, with counts on the provider chips", async () => {
    const m = await mount(() => undefined);
    expect(m.host.querySelector(TRIGGER)!.textContent).toBe("Claude X OneHarbor · 200K ctx");
    expect(m.host.querySelector(`${TRIGGER} svg`)).not.toBeNull();
    act(() => m.host.querySelector<HTMLButtonElement>(TRIGGER)!.click());
    expect([...m.host.querySelectorAll(".bth-grp .grp-hd")].map((h) => h.textContent)).toEqual(["Harbor", "Cove"]);
    expect([...m.host.querySelectorAll(OPTIONS)].map(titleOf)).toEqual(["Claude X One", "plain-2", "m" + "Setup Required"]);
    expect([...m.host.querySelectorAll(".bth-chips button")].map((c) => c.textContent)).toEqual(["All2", "Harbor2", "Cove0"]);
    expect(m.host.querySelector(".bth-dlist")).not.toBeNull();
    expect(m.host.querySelector(`${OPTIONS}[data-selected] > span:last-child svg`)).not.toBeNull();
    m.done();
  });

  test("a search narrows by display name or id, a connection that cannot be used cannot be picked, and a pick closes the list", async () => {
    const picked: ChatConnection[] = [];
    const m = await mount((c) => picked.push(c));
    act(() => m.host.querySelector<HTMLButtonElement>(TRIGGER)!.click());
    const input = m.host.querySelector<HTMLInputElement>(".bth-ds input")!;
    const key = Object.keys(input).find((k) => k.startsWith("__reactProps$"))!;
    act(() => (input as unknown as Record<string, { onChange(e: unknown): void }>)[key]!.onChange({ target: { value: "one" } }));
    expect([...m.host.querySelectorAll(OPTIONS)].map((b) => b.textContent)).toEqual(["Claude X OneHarbor · 200K ctx"]);
    act(() => (input as unknown as Record<string, { onChange(e: unknown): void }>)[key]!.onChange({ target: { value: "" } }));
    expect(m.host.querySelectorAll<HTMLButtonElement>(OPTIONS)[2]!.disabled).toBe(true);
    act(() => m.host.querySelectorAll<HTMLButtonElement>(OPTIONS)[1]!.click());
    expect(picked).toEqual([{ id: "k1", model: "plain-2" }]);
    expect(m.host.querySelector(".bth-drop")).toBeNull();
    m.done();
  });
});
