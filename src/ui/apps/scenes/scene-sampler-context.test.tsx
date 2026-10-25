/**
 * The SamplerBar's Context Mode buttons and Max Messages slider (RoleCall's QuickPlayPanel.tsx:1967-2036):
 * tokens mode shows the context-size slider, messages mode swaps it for Max Messages with the
 * "~N tokens (K of T)" footer, which reads the same window function the send path uses.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { ChatPresetSamplers, Message } from "../../../stage/contracts/chat-store";
import type { SamplerHistory } from "./sampler-history";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true, extraGlobals: ["HTMLInputElement", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const msg = (role: string, content: string) => ({ role, current: 0, swipes: [{ content }] }) as unknown as Message;

async function bar(own: ChatPresetSamplers, history?: SamplerHistory) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { SamplerBar } = await import("./scene-preset-parts");
  const { SamplerHistoryContext } = await import("./sampler-history");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const sets: [string, unknown][] = [];
  flushSync(() => createRoot(host).render(<SamplerHistoryContext.Provider value={history}><SamplerBar preset={{}} own={own} onSet={(k, v) => void sets.push([k, v])} /></SamplerHistoryContext.Provider>));
  flushSync(() => host.querySelector<HTMLButtonElement>(".sbar-row")!.click());
  return { host, sets };
}
const labels = (host: HTMLElement) => [...host.querySelectorAll(".slh span")].map((e) => e.textContent);

describe("Context Mode and Max Messages", () => {
  test("tokens mode (the default) shows the context-size slider and no Max Messages", async () => {
    const { host } = await bar({});
    expect(labels(host)).toContain("Max Context");
    expect(labels(host)).not.toContain("Max Messages");
    expect(host.querySelector('[aria-label="Context Mode"] [aria-pressed=true]')?.textContent).toBe("tokens");
  });

  test("messages mode swaps in Max Messages, 0 to 1000, with the estimate of what the next send carries", async () => {
    const messages = [msg("assistant", "hello"), msg("user", "a"), msg("assistant", "b"), msg("user", "now")];
    const { host } = await bar({ contextMode: "messages", maxMessages: 1 }, { messages, total: 90 });
    expect(labels(host)).toContain("Max Messages");
    expect(labels(host)).not.toContain("Max Context");
    const range = [...host.querySelectorAll<HTMLInputElement>("input[type=range]")].find((i) => i.max === "1000")!;
    expect([range.min, range.max, range.step, range.value]).toEqual(["0", "1000", "1", "1"]);
    expect(host.textContent).toMatch(/~\d+ tokens·3 of 90/);
  });

  test("an unknown chat reads estimating, an empty one reads empty chat", async () => {
    expect((await bar({ contextMode: "messages" })).host.textContent).toContain("estimating...");
    expect((await bar({ contextMode: "messages" }, { messages: [], total: 0 })).host.textContent).toContain("~0 tokens (empty chat)");
  });

  test("the buttons set the mode", async () => {
    const { host, sets } = await bar({});
    const { flushSync } = await import("react-dom");
    flushSync(() => [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Context Mode"] button')].find((b) => b.textContent === "messages")!.click());
    expect(sets).toEqual([["contextMode", "messages"]]);
  });
});
