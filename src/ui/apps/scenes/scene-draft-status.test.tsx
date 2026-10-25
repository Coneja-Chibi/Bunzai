/**
 * Expand as character and Polish Input at the composer (use-composer-drafts.ts, scene-draft-status.tsx): the
 * answer lands in the composer and is never sent, the ribbons and the pill say what RoleCall's do, a polish pass
 * that changes nothing says so and leaves the text alone, Revert puts the original back, and a cancelled or failed
 * run leaves the composer exactly as it was.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { useState, type JSX } from "react";
import type { DraftInput } from "../../../studio/scene-draft";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import { useComposerDrafts } from "./use-composer-drafts";
import { DraftStatusStrip, PerspectivePill } from "./scene-draft-status";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

type Call = { input: DraftInput; signal: AbortSignal | undefined; settle(value: string | Error): void };

async function mount(initial: string) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const calls: Call[] = [];
  const api = {
    runSceneDraft: (input: DraftInput, signal?: AbortSignal) =>
      new Promise<{ text: string }>((resolve, reject) => {
        calls.push({ input, signal, settle: (v) => (typeof v === "string" ? resolve({ text: v }) : reject(v)) });
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  };
  function Harness(): JSX.Element {
    const [text, setText] = useState(initial);
    const drafts = useComposerDrafts({ api, chatId: "c1", text, setText });
    return (
      <div>
        <DraftStatusStrip drafts={drafts} persona="Mira" />
        <textarea aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} />
        <PerspectivePill onPick={drafts.expand} />
        <button type="button" id="polish" onClick={drafts.polish} />
        <button type="button" id="begin" onClick={drafts.beginExpand} />
      </div>
    );
  }
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(<Harness />));
  const settle = () => flushTasks();
  const click = async (el: Element | null) => { flushSync(() => (el as HTMLElement).click()); await settle(); };
  const byText = (t: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === t) ?? null;
  const byId = (id: string) => [...host.querySelectorAll("button")].find((b) => b.id === id) ?? null;
  const box = () => host.querySelector<HTMLTextAreaElement>("textarea")!.value;
  return { host, calls, click, byText, byId, box, flushSync, settle, strip: () => host.querySelector("[data-part='scene.composer.draft']") };
}

describe("Expand as character", () => {
  test("a pill segment sends the composer's text as the outline with that perspective, shows the ribbon, and lands the answer in the composer", async () => {
    const m = await mount("ask about storms");
    await m.click(m.byText("3RD"));
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]!.input).toEqual({ chatId: "c1", kind: "impersonate", brief: "ask about storms", perspective: "3rd" });
    expect(m.strip()!.textContent).toContain("Writing as Mira");
    expect(m.strip()!.textContent).toContain("Drafting your message, landing in the input shortly.");
    expect(m.box()).toBe("ask about storms");
    m.calls[0]!.settle("Mira asks the keeper about the storms.");
    await m.settle();
    expect(m.box()).toBe("Mira asks the keeper about the storms.");
    expect(m.strip()!.textContent).toContain("Edit and send when ready.");
  });

  test("Cancel after it landed clears the composer; the pill is lit on 1ST until another is picked", async () => {
    const m = await mount("");
    expect(m.byText("1ST")!.getAttribute("aria-pressed")).toBe("true");
    await m.click(m.byText("2ND"));
    expect(m.byText("2ND")!.getAttribute("aria-pressed")).toBe("true");
    expect(m.calls[0]!.input).toMatchObject({ brief: "", perspective: "2nd" });
    m.calls[0]!.settle("You speak.");
    await m.settle();
    await m.click(m.byText("Cancel"));
    expect(m.box()).toBe("");
    expect(m.strip()).toBeNull();
  });

  test("Cancel while it runs aborts the request and leaves the composer's text alone", async () => {
    const m = await mount("my outline");
    await m.click(m.byText("1ST"));
    await m.click(m.byText("Cancel"));
    expect(m.calls[0]!.signal!.aborted).toBe(true);
    expect(m.box()).toBe("my outline");
    expect(m.strip()).toBeNull();
  });

  test("a second pick while one is running is dropped", async () => {
    const m = await mount("x");
    await m.click(m.byText("1ST"));
    await m.click(m.byText("3RD"));
    expect(m.calls).toHaveLength(1);
  });

  test("a failure shows the reason, dismisses, and leaves the composer's text alone", async () => {
    const m = await mount("my outline");
    await m.click(m.byText("1ST"));
    m.calls[0]!.settle(new Error("this scene has no connection; pick one in the AI wing"));
    await m.settle();
    expect(m.strip()!.textContent).toContain("no connection");
    expect(m.box()).toBe("my outline");
    await m.click(m.host.querySelector("button[aria-label='Dismiss']"));
    expect(m.strip()).toBeNull();
  });

  test("expand mode (the message menu's Expand as character) shows the pill and ribbon without calling the model or using any message text", async () => {
    const m = await mount("");
    await m.click(m.byId("begin"));
    expect(m.calls).toHaveLength(0);
    expect(m.strip()!.textContent).toContain("Type an outline, then pick a perspective to expand.");
    expect(m.strip()!.querySelectorAll(".ds-pill button")).toHaveLength(3);
    await m.click(m.strip()!.querySelector(".ds-pill button:nth-child(2)"));
    expect(m.calls[0]!.input).toMatchObject({ kind: "impersonate", brief: "", perspective: "2nd" });
  });
});

describe("Polish Input", () => {
  test("empty text says to type something first and calls nothing", async () => {
    const m = await mount("   ");
    await m.click(m.byId("polish"));
    expect(m.calls).toHaveLength(0);
    expect(m.strip()!.textContent).toBe("Type something first to polish.");
  });

  test("a change replaces the text, keeps the original, and Revert puts it back", async () => {
    const m = await mount("i walks in");
    await m.click(m.byId("polish"));
    expect(m.calls[0]!.input).toEqual({ chatId: "c1", kind: "polish", text: "i walks in" });
    expect(m.strip()!.textContent).toContain("Polishing your draft");
    m.calls[0]!.settle("I walk in.");
    await m.settle();
    expect(m.box()).toBe("I walk in.");
    expect(m.strip()!.textContent).toContain("Polished");
    await m.click(m.byText("Show diff"));
    expect(m.strip()!.textContent).toContain("i walks in");
    await m.click(m.byText("Revert"));
    expect(m.box()).toBe("i walks in");
    expect(m.strip()).toBeNull();
  });

  test("Keep (the close) leaves the polished text and hides the panel", async () => {
    const m = await mount("hi");
    await m.click(m.byId("polish"));
    m.calls[0]!.settle("Hi.");
    await m.settle();
    await m.click(m.host.querySelector("button[aria-label='Keep polished draft and close comparison']"));
    expect(m.box()).toBe("Hi.");
    expect(m.strip()).toBeNull();
  });

  test("an unchanged pass says Nothing to fix and does not touch the text", async () => {
    const m = await mount("Already fine.");
    await m.click(m.byId("polish"));
    m.calls[0]!.settle("Already fine.");
    await m.settle();
    expect(m.strip()!.textContent).toBe("Nothing to fix.");
    expect(m.box()).toBe("Already fine.");
  });
});
