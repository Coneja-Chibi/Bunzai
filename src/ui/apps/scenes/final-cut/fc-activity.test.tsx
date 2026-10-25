/**
 * The Final Cut activity dialog (RoleCall's PostProdActivityBadge dialog): a saved run read back with the worst status, each pass's
 * result and changelog, a Before / After diff, Undo that puts the original back as an edit, and a re-run that only previews until
 * Apply. A run the page cannot read is "no run", and a failed Apply says why and leaves the reply alone.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom, flushTasks } from "../../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
const roots: { unmount(): void }[] = [];
afterEach(async () => {
  const { flushSync } = await import("react-dom");
  flushSync(() => roots.splice(0).forEach((r) => r.unmount()));
});

const RUN = {
  v: 1, at: 1, ms: 900, original: "She felt the cold.",
  passes: [
    { id: "p1", type: "anti-slop", status: "applied", changed: true, ms: 800, model: "gpt-x", changelog: [{ rule: "Filter words", description: "Cut 'felt'." }], warnings: ["a warning"], ruleReview: [{ rule: "Filter words", verdict: "applied", reasoning: "fired once" }], raw: "{raw body}" },
    { id: "p2", type: "validator", status: "applied", changed: false, ms: 1, changelog: [], warnings: [] },
  ],
};

async function mount(over: { run?: unknown; text?: string; rerun?: { text: string; run: unknown } | Error; onApply?(t: string): Promise<void>; enabled?: number } = {}) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { FinalCutActivity } = await import("./fc-activity");
  const applies: string[] = [];
  const rerunApplies: string[] = [];
  let closed = 0;
  const api = {
    getFinalCutRun: async () => ({ messageId: "m1", swipeId: "s1", text: over.text ?? "The cold came.", run: "run" in over ? over.run : RUN }),
    rerunFinalCut: async () => { if (over.rerun instanceof Error) throw over.rerun; return { rerunId: "r1", messageId: "m1", swipeId: "s1", ...(over.rerun ?? { text: "x", run: RUN }), summary: { passes: 1, changed: true, failed: 0 } }; },
  };
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<FinalCutActivity api={api} chatId="c1" messageId="m1" enabled={over.enabled ?? 2} onApply={over.onApply ?? (async (t) => void applies.push(t))} onApplyRerun={async (id) => void rerunApplies.push(id)} onClose={() => void closed++} />));
  const settle = () => flushTasks();
  await settle();
  const doc = dom.window.document;
  const byText = (t: string) => [...doc.querySelectorAll("button")].find((b) => b.textContent?.trim() === t) ?? null;
  const click = async (el: Element | null) => { flushSync(() => (el as HTMLElement).click()); await settle(); };
  const text = () => doc.querySelector("[data-part='scene.finalcut.activity']")?.textContent ?? "";
  return { applies, rerunApplies, closed: () => closed, byText, click, text, doc };
}

describe("the re-run history", () => {
  const RERUNS = [{ at: 7, ms: 1200, before: "She felt the cold.", after: "The cold came.", passes: RUN.passes }, { at: 9, ms: 800, before: "The cold came.", after: "The warm came.", passes: RUN.passes }];
  test("lists each applied re-run with its length and what it changed, oldest first", async () => {
    const m = await mount({ run: { ...RUN, reruns: RERUNS }, text: "The warm came." });
    const items = [...m.doc.querySelectorAll(".fa-hist li")];
    expect(items).toHaveLength(2);
    expect(items[0]!.querySelector("summary")!.textContent).toBe("Re-run 1: 2 passes, 1.2s");
    expect(items[1]!.querySelector("summary")!.textContent).toBe("Re-run 2: 2 passes, 800ms");
    expect([...items[1]!.querySelectorAll("ins")].map((e) => e.textContent).join("")).toContain("warm");
  });
  test("only the latest re-run, while its text is still the one shown, offers Undo, and Undo is an edit back to what it replaced", async () => {
    const m = await mount({ run: { ...RUN, reruns: RERUNS }, text: "The warm came." });
    const undos = [...m.doc.querySelectorAll<HTMLButtonElement>(".fa-hist button")].filter((b) => b.textContent === "Undo this re-run");
    expect(undos).toHaveLength(1);
    await m.click(undos[0]!);
    expect(m.applies).toEqual(["The cold came."]);
  });
  test("a re-run whose text was edited since offers no Undo", async () => {
    const edited = await mount({ run: { ...RUN, reruns: RERUNS }, text: "Edited since." });
    expect([...edited.doc.querySelectorAll(".fa-hist button")].some((b) => b.textContent === "Undo this re-run")).toBe(false);
  });
  test("a run with no re-runs shows no history", async () => {
    const m = await mount();
    expect(m.doc.querySelector(".fa-hist")).toBeNull();
  });
});

describe("the activity dialog", () => {
  test("reads the run: the overall result, each pass with its status, model, changelog and warnings, and the raw reply behind a disclosure", async () => {
    const m = await mount();
    expect(m.text()).toContain("Final Cut Activity");
    expect(m.text()).toContain("1 pass applied changes");
    expect(m.text()).toContain("Anti-Slop");
    expect(m.text()).toContain("Applied");
    expect(m.text()).toContain("800ms");
    expect(m.text()).toContain("gpt-x");
    expect(m.text()).toContain("Filter words");
    expect(m.text()).toContain("Cut 'felt'.");
    expect(m.text()).toContain("a warning");
    expect(m.text()).toContain("fired once");
    expect(m.doc.querySelector("details")!.textContent).toContain("{raw body}");
  });

  test("Before / After shows the original against the saved text; Undo puts the original back through Apply", async () => {
    const m = await mount();
    await m.click(m.byText("Before / After"));
    expect(m.doc.querySelector(".fa-diff del")!.textContent).toContain("felt");
    expect([...m.doc.querySelectorAll(".fa-diff ins")].map((e) => e.textContent).join("")).toContain("came");
    await m.click(m.byText("Undo"));
    expect(m.applies).toEqual(["She felt the cold."]);
    expect(m.closed()).toBe(1);
  });

  test("a reply the passes left alone has no original, so no Undo", async () => {
    const m = await mount({ run: { ...RUN, original: undefined } });
    await m.click(m.byText("Before / After"));
    expect(m.text()).toContain("The passes left this reply unchanged.");
    expect(m.byText("Undo")).toBeNull();
  });

  test("a run the page cannot read, or none, is said plainly", async () => {
    expect((await mount({ run: { v: 9 } })).text()).toContain("This reply has no saved Final Cut run.");
    expect((await mount({ run: null })).text()).toContain("This reply has no saved Final Cut run.");
  });

  test("Rerun previews the new text and writes nothing until Apply; Cancel drops it", async () => {
    const m = await mount({ rerun: { text: "The cold bit.", run: RUN } });
    expect(m.byText("Rerun 2 enabled passes")).not.toBeNull();
    await m.click(m.byText("Rerun 2 enabled passes"));
    expect(m.text()).toContain("Rerun preview");
    expect(m.doc.querySelector(".fa-rerun ins")!.textContent).toContain("bit");
    expect(m.applies).toEqual([]);
    await m.click(m.byText("Cancel"));
    expect(m.text()).not.toContain("Rerun preview");
    await m.click(m.byText("Rerun 2 enabled passes"));
    await m.click(m.byText("Apply"));
    expect(m.rerunApplies).toEqual(["r1"]);
    expect(m.applies).toEqual([]);
  });

  test("a rerun that changes nothing says so and offers no Apply; with no passes enabled the button is off", async () => {
    const m = await mount({ rerun: { text: "The cold came.", run: RUN } });
    await m.click(m.byText("Rerun 2 enabled passes"));
    expect(m.text()).toContain("The rerun changed nothing.");
    expect(m.byText("Apply")).toBeNull();
    const none = await mount({ enabled: 0 });
    expect((none.byText("Rerun enabled passes") as HTMLButtonElement).disabled).toBe(true);
  });

  test("a rerun that fails, and an Apply that fails, say why and leave the reply alone", async () => {
    const bad = await mount({ rerun: new Error("no connection") });
    await bad.click(bad.byText("Rerun 2 enabled passes"));
    expect(bad.doc.querySelector("[role=alert]")!.textContent).toBe("no connection");
  });

  test("an Apply that fails says why, leaves the dialog open and the reply alone", async () => {
    const stale = await mount({ onApply: async () => { throw new Error("The scene changed"); } });
    await stale.click(stale.byText("Before / After"));
    await stale.click(stale.byText("Undo"));
    expect(stale.doc.querySelector("[role=alert]")!.textContent).toBe("The scene changed");
    expect(stale.closed()).toBe(0);
  });
});
