/** The Script Sheet editor (RoleCall's ScriptSheetEditor.tsx) as it mounts: what Save does, and what it refuses. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "./test-dom";
import type { SheetDraft } from "./script-sheet-editor";

let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "Event", "KeyboardEvent"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
});
afterAll(() => installed.teardown());

const tick = () => new Promise((r) => setTimeout(r, 0));

async function mount(props: { initial?: SheetDraft; save(d: SheetDraft): Promise<void>; choose?(): Promise<void>; onBack?(): void }) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ScriptSheetEditor } = await import("./script-sheet-editor");
  const host = document.createElement("div");
  document.body.appendChild(host);
  let root!: Root;
  await act(async () => { root = createRoot(host); root.render(<ScriptSheetEditor onBack={() => undefined} {...props} />); });
  const button = (text: RegExp) => [...host.querySelectorAll("button")].find((b) => text.test(b.textContent ?? ""))!;
  const type = async (selector: string, value: string) => {
    const el = host.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement;
    const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  const click = async (text: RegExp) => { await act(async () => { button(text).click(); await tick(); }); };
  return { host, button, type, click, unmount: async () => act(async () => root.unmount()) };
}

test("a new sheet saves, then is chosen for the scene; blank or context macros keep Save off", async () => {
  const saved: SheetDraft[] = [];
  let used = 0;
  const ed = await mount({ save: async (d) => { saved.push(d); }, choose: async () => { used++; } });
  expect(ed.button(/Save & use Script Sheet/).disabled).toBe(true);
  await ed.type("#script-sheet-content", "Use {{lore}} please.");
  expect(ed.host.textContent).toContain("included automatically");
  expect(ed.button(/Save & use Script Sheet/).disabled).toBe(true);
  await ed.type("#script-sheet-content", "Write tersely as {{char}}.");
  await ed.type("#script-sheet-name", "Terse");
  expect(ed.button(/Save & use Script Sheet/).disabled).toBe(false);
  await ed.click(/Save & use Script Sheet/);
  expect(saved).toEqual([{ name: "Terse", content: "Write tersely as {{char}}." }]);
  expect(used).toBe(1);
  await ed.unmount();
});

test("when choosing fails the saved sheet is kept and the button offers to use it, without saving again", async () => {
  let saves = 0;
  let tries = 0;
  const ed = await mount({ save: async () => { saves++; }, choose: async () => { if (++tries === 1) throw new Error("The scene could not take it."); } });
  await ed.type("#script-sheet-content", "Be brief.");
  await ed.click(/Save & use Script Sheet/);
  expect(ed.host.textContent).toContain("The scene could not take it.");
  expect(ed.button(/Use saved Script Sheet/)).toBeDefined();
  await ed.click(/Use saved Script Sheet/);
  expect(saves).toBe(1);
  expect(tries).toBe(2);
  await ed.unmount();
});

test("a failed save keeps the draft and says why; going back with changes asks first", async () => {
  let back = 0;
  const ed = await mount({ initial: { name: "Old", content: "Old text." }, save: async () => { throw new Error("This Script Sheet changed somewhere else first."); }, onBack: () => { back++; } });
  await ed.type("#script-sheet-content", "New text.");
  await ed.click(/^Save Script Sheet$/);
  expect(ed.host.textContent).toContain("changed somewhere else first");
  expect((ed.host.querySelector("#script-sheet-content") as HTMLTextAreaElement).value).toBe("New text.");
  await ed.click(/Back to Script Sheets/);
  expect(back).toBe(0);
  expect(ed.host.textContent).toContain("Discard unsaved changes?");
  await ed.click(/Discard draft/);
  expect(back).toBe(1);
  await ed.unmount();
});
