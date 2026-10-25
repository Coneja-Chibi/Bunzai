/** A retained editor must not consume another app's save shortcut or a native protected prompt's keys. */
import { afterAll, expect, test } from "bun:test";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AppActivity } from "../../_shared/app-activity";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import { useEditorGuards } from "./use-editor-guards";
import { EditorKeyOwner } from "./editor-key-owner";

afterAll(teardownAllDoms);
test("Ctrl+S saves only the visible editor and yields while a protected prompt is open", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const root = createRoot(dom.window.document.getElementById("root")!); let saves = 0;
  const ctx = { prefs: { get: () => false }, workbench: { setDirty: () => {} } } as unknown as AppContext;
  function Editor() { useEditorGuards(ctx, { id: "one", kind: "character", name: "Draft" }, true, async () => { saves++; }); return null; }
  const render = (active: boolean) => flushSync(() => root.render(<AppActivity.Provider value={active}><Editor /></AppActivity.Provider>));
  const saveKey = () => { const event = new dom.window.KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }); flushSync(() => dom.window.document.body.dispatchEvent(event)); return event; };
  try {
    render(false); expect(saveKey().defaultPrevented).toBe(false); expect(saves).toBe(0);
    render(true); expect(saveKey().defaultPrevented).toBe(true); expect(saves).toBe(1);
    const prompt = dom.window.document.createElement("dialog"); prompt.open = true; dom.window.document.body.append(prompt);
    expect(saveKey().defaultPrevented).toBe(false); expect(saves).toBe(1); prompt.remove();
  } finally { flushSync(() => root.unmount()); }
});

test("a save key from the second visible split editor belongs to that editor", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div><section data-editor="frame" id="first"><input></section><section data-editor="frame" id="second"><input></section>', { globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const doc = dom.window.document; const root = createRoot(doc.getElementById("root")!); const saves: string[] = [];
  const ctx = { prefs: { get: () => false }, workbench: { setDirty: () => {} } } as unknown as AppContext;
  function Editor({ id }: { id: string }) { useEditorGuards(ctx, { id, kind: "character", name: id }, true, async () => { saves.push(id); }); return null; }
  try {
    flushSync(() => root.render(<>{["first", "second"].map((id) => <EditorKeyOwner.Provider key={id} value={{ root: doc.getElementById(id), primary: id === "first" }}><Editor id={id} /></EditorKeyOwner.Provider>)}</>));
    flushSync(() => doc.querySelector("#second input")!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })));
    expect(saves).toEqual(["second"]);
  } finally { flushSync(() => root.unmount()); }
});
