/**
 * The Last Message as User row (RoleCall's QuickPlayPanel.tsx:2173-2199 switch): shows the scene's setting with
 * RoleCall's hint, writes {lastAsUser} through the scene's prompting setter, and puts the old state back
 * with a status line when the write fails.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const chat = (on: boolean): Chat => ({ id: "c1", ...(on ? { prompting: { lastAsUser: true } } : {}) }) as unknown as Chat;

async function mount(on: boolean, write: (patch: unknown) => Promise<Chat>) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { LastAsUserRow } = await import("./scene-last-as-user-row");
  const calls: unknown[] = [];
  const status: string[] = [];
  const changed: Chat[] = [];
  const ctx = { api: { setScenePrompting: async (id: string, patch: unknown) => { calls.push([id, patch]); return write(patch); } }, setStatus: (t: string) => void status.push(t) } as unknown as AppContext;
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(<LastAsUserRow ctx={ctx} chat={chat(on)} onChanged={(c) => void changed.push(c)} />));
  const toggle = () => host.querySelector<HTMLButtonElement>("button[role=switch]")!;
  const settle = () => flushTasks();
  return { host, toggle, calls, status, changed, flushSync, settle };
}

describe("Last Message as User row", () => {
  test("names the setting with RoleCall's hint and shows the scene's state", async () => {
    const off = await mount(false, async () => chat(true));
    expect(off.host.textContent).toContain("Last Message as User");
    expect(off.host.textContent).toContain("Re-tag the final outbound message as user for models that reject assistant prefills.");
    expect(off.toggle().getAttribute("aria-checked")).toBe("false");
    expect((await mount(true, async () => chat(false))).toggle().getAttribute("aria-checked")).toBe("true");
  });

  test("a click writes the opposite through the prompting setter and hands the saved scene back", async () => {
    const m = await mount(false, async () => chat(true));
    m.flushSync(() => m.toggle().click());
    await m.settle();
    expect(m.calls).toEqual([["c1", { lastAsUser: true }]]);
    expect(m.changed).toHaveLength(1);
    expect(m.changed[0]!.prompting?.lastAsUser).toBe(true);
  });

  test("a failed write puts the switch back and says so", async () => {
    const m = await mount(false, async () => { throw new Error("offline"); });
    m.flushSync(() => m.toggle().click());
    await m.settle();
    expect(m.toggle().getAttribute("aria-checked")).toBe("false");
    expect(m.status[0]).toContain("Last Message as User");
    expect(m.changed).toEqual([]);
  });
});
