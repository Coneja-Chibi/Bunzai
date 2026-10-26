/**
 * Correction Tools (scene-correct.tsx, use-scene-correct.tsx): RoleCall's three tabs, with RoleCall's copy. The
 * Corrections tab lists only correction guides, Rewrite's Delete never calls the model, nothing is applied
 * until Apply, a failed tool says why and changes nothing, and Apply edits the shown version in place through
 * the scene's edit route (a stale take reloads and says so).
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { GuideRecord } from "../../../core/guide-record";
import type { Message } from "../../../stage/contracts/chat-store";
import type { DraftInput } from "../../../studio/scene-draft";
import type { OpenScene } from "../../../studio/scenes";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import { textRange } from "../../../core/draft-prompts";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

/** Every mounted root, unmounted after each test: a dialog is portaled to the body and would outlive its test. */
const roots: { unmount(): void }[] = [];
afterEach(async () => {
  const { flushSync } = await import("react-dom");
  flushSync(() => roots.splice(0).forEach((r) => r.unmount()));
});

const guide = (id: string, title: string, over: Partial<GuideRecord> = {}): GuideRecord => ({
  id, title, content: `${title} text`, type: "guide", category: "situational", role: "user", mode: "standard", depth: null, target: null, side: null, visible: true, createdAt: 1, updatedAt: 1, ...over,
});
const LIBRARY = [guide("g1", "Past tense", { type: "correction" }), guide("g2", "Be brief"), guide("g3", "Hidden fix", { type: "correction", visible: false }), guide("g4", "Typos", { type: "spellcheck" })];

type Asked = { input: DraftInput; settle(v: string | Error): void };

async function mountTools(opts: { message?: string; selection?: ReturnType<typeof textRange>; guides?: GuideRecord[]; onApply?(text: string): Promise<void> } = {}) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { CorrectionTools } = await import("./scene-correct");
  const asked: Asked[] = [];
  const applies: string[] = [];
  let closed = 0;
  const api = {
    runSceneDraft: (input: DraftInput) => new Promise<{ text: string }>((resolve, reject) => void asked.push({ input, settle: (v) => (typeof v === "string" ? resolve({ text: v }) : reject(v)) })),
    listGuides: async () => opts.guides ?? LIBRARY,
  };
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(
    <CorrectionTools api={api} chatId="c1" message={opts.message ?? "She walked quickly home."} selection={opts.selection ?? null} onClose={() => void closed++}
      onApply={opts.onApply ?? (async (t) => void applies.push(t))} />,
  ));
  const settle = () => flushTasks();
  await settle();
  const doc = dom.window.document;
  const buttons = () => [...doc.querySelectorAll("button")];
  const byText = (t: string) => buttons().find((b) => b.textContent?.trim() === t) ?? null;
  const click = async (el: Element | null) => { flushSync(() => (el as HTMLElement).click()); await settle(); };
  const text = () => doc.querySelector("[data-part='scene.correct']")!.textContent ?? "";
  return { asked, applies, closed: () => closed, click, byText, text, settle, doc, flushSync };
}

function select(m: Awaited<ReturnType<typeof mountTools>>, start: number, end: number): void {
  const area = m.doc.querySelector<HTMLTextAreaElement>("textarea")!;
  area.focus();
  area.setSelectionRange(start, end);
  m.flushSync(() => void area.dispatchEvent(new (m.doc.defaultView!.Event)("keyup", { bubbles: true })));
}

describe("Spellcheck", () => {
  test("shows RoleCall's line and the three tabs; Run Spellcheck previews Original beside Polished; Apply writes the trimmed text and closes", async () => {
    const m = await mountTools();
    expect(m.text()).toContain("Automatically polish grammar, spelling, and readability while maintaining the character's voice.");
    expect([...m.doc.querySelectorAll("[role='tab']")].map((t) => t.textContent)).toEqual(["Spellcheck", "Corrections", "Rewrite"]);
    await m.click(m.byText("Run Spellcheck"));
    expect(m.asked[0]!.input).toEqual({ chatId: "c1", kind: "spellcheck", text: "She walked quickly home." });
    m.asked[0]!.settle("  She walked quickly home.  ");
    await m.settle();
    expect(m.text()).toContain("Original");
    expect(m.text()).toContain("Polished");
    expect(m.applies).toEqual([]);
    await m.click(m.byText("Apply"));
    expect(m.applies).toEqual(["She walked quickly home."]);
    expect(m.closed()).toBe(1);
  });

  test("Cancel returns to the button without applying", async () => {
    const m = await mountTools();
    await m.click(m.byText("Run Spellcheck"));
    m.asked[0]!.settle("Polished.");
    await m.settle();
    await m.click(m.byText("Cancel"));
    expect(m.byText("Run Spellcheck")).not.toBeNull();
    expect(m.applies).toEqual([]);
  });

  test("a model failure shows its reason, applies nothing, and the tool can be run again", async () => {
    const m = await mountTools();
    await m.click(m.byText("Run Spellcheck"));
    m.asked[0]!.settle(new Error("this scene has no connection; pick one in the AI wing"));
    await m.settle();
    expect(m.doc.querySelector("[role='alert']")!.textContent).toContain("no connection");
    expect(m.byText("Run Spellcheck")).not.toBeNull();
    expect(m.applies).toEqual([]);
  });

  test("an Apply that fails keeps the dialog open and says why", async () => {
    const m = await mountTools({ onApply: async () => { throw new Error("The scene changed in another window"); } });
    await m.click(m.byText("Run Spellcheck"));
    m.asked[0]!.settle("Better.");
    await m.settle();
    await m.click(m.byText("Apply"));
    expect(m.closed()).toBe(0);
    expect(m.doc.querySelector("[role='alert']")!.textContent).toContain("changed in another window");
  });
});

describe("Corrections", () => {
  test("lists correction guides only, with RoleCall's empty state when there are none", async () => {
    const m = await mountTools();
    await m.click(m.byText("Corrections"));
    expect([...m.doc.querySelectorAll(".cx-guides [data-control='row']")].map((r) => r.querySelector("small")!.previousElementSibling!.textContent)).toEqual(["Past tense"]);
  });

  test("with no correction guides it says so, and where to make one", async () => {
    const none = await mountTools({ guides: [guide("g2", "Be brief")] });
    await none.click(none.byText("Corrections"));
    expect(none.text()).toContain("No correction guides available");
    expect(none.text()).toContain("Create correction guides in the Guides panel");
  });

  test("Apply Correction needs a pick, sends that guide, previews Original beside Corrected, and Apply writes it", async () => {
    const m = await mountTools();
    await m.click(m.byText("Corrections"));
    expect((m.byText("Apply Correction") as HTMLButtonElement).disabled).toBe(true);
    await m.click(m.doc.querySelector(".cx-guides [data-control='row']"));
    await m.click(m.byText("Apply Correction"));
    expect(m.asked[0]!.input).toEqual({ chatId: "c1", kind: "correct", text: "She walked quickly home.", guideId: "g1" });
    m.asked[0]!.settle("She had walked quickly home.");
    await m.settle();
    expect(m.text()).toContain("Corrected");
    await m.click(m.byText("Apply"));
    expect(m.applies).toEqual(["She had walked quickly home."]);
  });
});

describe("Rewrite", () => {
  test("Custom needs a passage and an instruction; it sends both, and its answer is previewed like the others", async () => {
    const m = await mountTools({ selection: textRange("She walked quickly home.", 4, 18) });
    expect((m.byText("Custom") as HTMLButtonElement).disabled).toBe(true);
    const field = m.doc.querySelector<HTMLInputElement>("input[aria-label='Custom instruction']")!;
    const { flushSync } = await import("react-dom");
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    flushSync(() => { setter.call(field, "Make her furious."); field.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
    await m.settle();
    expect((m.byText("Custom") as HTMLButtonElement).disabled).toBe(false);
    await m.click(m.byText("Custom"));
    expect(m.asked[0]!.input).toEqual({ chatId: "c1", kind: "rewrite", text: "She walked quickly home.", selected: "walked quickly", action: "custom", instruction: "Make her furious." });
    m.asked[0]!.settle("stormed");
    await m.settle();
    expect(m.text()).toContain("She stormed home.");
  });

  test("opens on a passage handed in from the message, and Expand sends the whole message with only that passage to replace", async () => {
    const m = await mountTools({ selection: textRange("She walked quickly home.", 4, 18) });
    expect(m.text()).toContain("Highlight a passage in the message");
    expect(m.text()).toContain("Selected 14 chars: walked quickly");
    await m.click(m.byText("Expand"));
    expect(m.asked[0]!.input).toEqual({ chatId: "c1", kind: "rewrite", text: "She walked quickly home.", selected: "walked quickly", action: "expand" });
    m.asked[0]!.settle("strode swiftly");
    await m.settle();
    expect(m.text()).toContain("Selected");
    expect(m.text()).toContain("Replacement");
    expect(m.text()).toContain("Revised Message");
    expect(m.text()).toContain("She strode swiftly home.");
    await m.click(m.byText("Apply"));
    expect(m.applies).toEqual(["She strode swiftly home."]);
  });

  test("the buttons wait for a highlight; Select all selects everything; Delete is local and previews (deleted)", async () => {
    const m = await mountTools();
    await m.click(m.byText("Rewrite"));
    expect(m.text()).toContain("No text selected");
    expect(["Delete", "Rewrite", "Expand", "Reduce"].map((t) => (m.doc.querySelector(".cx-grid")!.textContent ?? "").includes(t))).toEqual([true, true, true, true]);
    expect([...m.doc.querySelectorAll<HTMLButtonElement>(".cx-grid button")].every((b) => b.disabled)).toBe(true);
    await m.click(m.byText("Select all"));
    await m.click(m.byText("Delete"));
    expect(m.asked).toHaveLength(0);
    expect(m.text()).toContain("(deleted)");
  });

  test("a highlight made in the box enables the model buttons", async () => {
    const m = await mountTools();
    await m.click(m.byText("Rewrite"));
    select(m, 4, 18);
    expect(m.text()).toContain("Selected 14 chars: walked quickly");
    await m.click(m.byText("Reduce"));
    expect(m.asked[0]!.input).toMatchObject({ kind: "rewrite", selected: "walked quickly", action: "reduce" });
  });
});

describe("Correct, wired to the scene", () => {
  const msg = (id: string, role: "user" | "assistant", content: string, over: Partial<Message> = {}): Message => ({ id, role, createdAt: 1, current: 0, swipes: [{ id: `${id}-s0`, content, createdAt: 1 }], ...over }) as unknown as Message;
  const sceneWith = (messages: Message[], branchVersion = 7): OpenScene => ({ chat: { id: "c1" }, messages, branchVersion }) as unknown as OpenScene;

  async function mountHook(scene: OpenScene | null, edit: (input: unknown) => Promise<unknown>) {
    const { flushSync } = await import("react-dom");
    const { createRoot } = await import("react-dom/client");
    const { useSceneCorrect } = await import("./use-scene-correct");
    const status: string[] = [];
    let reloads = 0;
    let api!: ReturnType<typeof useSceneCorrect>;
    const fake = { runSceneDraft: async () => ({ text: "Fixed." }), listGuides: async () => [], editSceneMessage: edit } as never;
    function Probe(): JSX.Element {
      api = useSceneCorrect({ api: fake, scene, reload: () => void reloads++, setStatus: (t) => void status.push(t) });
      return <>{api.modal}</>;
    }
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    roots.push(root);
    flushSync(() => root.render(<Probe />));
    const settle = () => flushTasks();
    return { api: () => api, status, reloads: () => reloads, flushSync, settle };
  }

  test("openLast with no AI message says so and opens nothing", async () => {
    const h = await mountHook(sceneWith([msg("m1", "user", "Hi")]), async () => ({}));
    h.flushSync(() => h.api().openLast());
    expect(h.status).toEqual(["No AI message yet to correct."]);
    expect(h.api().modal).toBeNull();
  });

  test("Apply edits the version that is shown, in place, against the scene's version, then reloads", async () => {
    const edits: unknown[] = [];
    const h = await mountHook(sceneWith([msg("m1", "user", "Hi"), msg("m2", "assistant", "She walked.", { current: 1, swipes: [{ id: "s0", content: "old", createdAt: 1 }, { id: "s1", content: "She walked.", createdAt: 2 }] } as never)]), async (i) => void edits.push(i));
    h.flushSync(() => h.api().openLast());
    await h.settle();
    const doc = dom.window.document;
    const byText = (t: string) => [...doc.querySelectorAll("button")].find((b) => b.textContent?.trim() === t)!;
    h.flushSync(() => byText("Run Spellcheck").click());
    await h.settle();
    h.flushSync(() => byText("Apply").click());
    await h.settle();
    expect(edits).toEqual([{ messageId: "m2", swipeId: "s1", content: "Fixed.", expectedVersion: 7 }]);
    expect(h.reloads()).toBe(1);
  });

  test("a stale take reloads the scene and tells the person to open Correct again, and the dialog stays", async () => {
    const stale = Object.assign(new Error("409"), { status: 409 });
    const h = await mountHook(sceneWith([msg("m1", "user", "Hi"), msg("m2", "assistant", "She walked.")]), async () => { throw stale; });
    h.flushSync(() => h.api().open("m2"));
    await h.settle();
    const doc = dom.window.document;
    const byText = (t: string) => [...doc.querySelectorAll("button")].find((b) => b.textContent?.trim() === t)!;
    h.flushSync(() => byText("Run Spellcheck").click());
    await h.settle();
    h.flushSync(() => byText("Apply").click());
    await h.settle();
    expect(h.reloads()).toBe(1);
    expect(doc.querySelector("[role='alert']")!.textContent).toContain("changed in another window");
  });
});
