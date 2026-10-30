/** Public Studio Strip interactions preserve preference callbacks, actions, completion and modal focus. */
import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom } from "../../../_shared/test-dom";
import { EditorChrome, type EditorChromeProps } from "./editor-chrome";

const installed = installDom(undefined, { extraGlobals: ["KeyboardEvent", "MouseEvent"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
beforeEach(() => installed.reinstall());
afterAll(() => installed.teardown());
let root: Root;
let host: HTMLElement;
let calls: string[];
const styles = new Proxy({}, { get: (_, key) => String(key) });
const chips = [["Portrait", true], ["Name", true], ["Core prompts", false], ["Greeting", true], ["Tags", false], ["Lens check", false]] as const;

async function mount(overrides: Partial<EditorChromeProps> = {}): Promise<void> {
  calls = [];
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const p: EditorChromeProps = {
    name: "Marguerite Vane", version: "v1", onClose: () => calls.push("close"),
    coverage: [{ id: "rolecall", label: "RoleCall", carries: [], notes: {} }], targets: [], platformLabel: () => "RoleCall",
    toggleTarget: id => calls.push(id), clearTargets: () => calls.push("clear"), offTarget: "hide", pickOffTarget: mode => calls.push(mode),
    lensActive: false, lensVisibleCount: 4, lensTotalCount: 6, chips,
    editorScale: 1, stepScale: dir => calls.push(`scale:${dir}`), setEditorScale: scale => calls.push(`reset:${scale}`), scaleMin: .5, scaleMax: 2,
    mode: "grid", setMode: mode => calls.push(mode), editorLayout: "bento", setEditorLayout: layout => calls.push(layout), layoutLocked: false,
    hasBehavior: true, workshop: false, setWorkshop: on => calls.push(`workshop:${on}`),
    saving: false, dirty: true, doSave: () => calls.push("save"), openExport: () => calls.push("export"), styles, ...overrides,
  };
  await act(async () => root.render(<EditorChrome {...p} />));
}
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); });
const button = (label: string): HTMLButtonElement => {
  const found = [...document.querySelectorAll("button")].find(b => b.textContent === label || b.getAttribute("aria-label") === label);
  if (!found) throw Error(`No button: ${label}`);
  return found;
};
const click = async (label: string): Promise<void> => { await act(async () => button(label).click()); };

test("the compact strip exposes modes and actions, with secondary choices behind their named controls", async () => {
  await mount();
  expect(document.querySelector('[role="group"][aria-label="Editor layout"]')).toBeNull();
  expect(document.querySelector('[aria-label="Writing for platform"]')).toBeNull();
  await click("Steps"); await click("Save"); await click("Export"); await click("Close");
  expect(calls).toEqual(["interview", "save", "export", "close"]);
  expect(document.querySelector('[role="status"]')?.textContent).toBe("Unsaved changes");
});

test("Save calls the save command without forwarding a DOM event as its optional intent", async () => {
  let received: unknown[] = [];
  await mount({ doSave: (...args: unknown[]) => { received = args; } });
  await click("Save");
  expect(received.length).toBe(0);
});

test("the platform dialog retains multiselect and off-target callbacks and restores focus on Escape", async () => {
  await mount();
  const opener = button("Writing for: Full card"); opener.focus();
  await click("Writing for: Full card");
  expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Writing for platform");
  await click("RoleCall"); await click("Dim");
  expect(calls).toEqual(["rolecall", "dim"]);
  await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement === opener).toBe(true);
});

test("view options preserve layout, workshop and scale commands", async () => {
  await mount(); await click("View options");
  await click("Playbill"); await click("Workshop"); await click("Scale editor up"); await click("100%"); await click("Scale editor down");
  expect(calls).toEqual(["playbill", "workshop:true", "scale:1", "reset:1", "scale:-1"]);
  await click("Done"); expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test("theme-owned arrangements remain locked and saving remains truthful", async () => {
  await mount({ layoutLocked: true, saving: true });
  expect(button("Save").disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toBe("Saving…");
  await click("View options");
  expect(button("Bento").disabled).toBe(true); expect(button("Playbill").disabled).toBe(true);
  await click("Playbill"); expect(calls).toEqual([]);
});

test("the completion summary still opens the complete checklist", async () => {
  await mount({ dirty: false });
  expect(button("Save").disabled).toBe(true);
  await click("3 of 6 complete");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Lens check");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Core prompts");
});
