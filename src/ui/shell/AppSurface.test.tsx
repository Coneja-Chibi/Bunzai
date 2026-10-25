/** Public app relocation preserves live drafts and keeps nested dialogs above the launcher. */
import { afterAll, expect, test } from "bun:test";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { DialogCore } from "../components/dialog-core";
import { AppSurface } from "./AppSurface";

afterAll(teardownAllDoms);
test("an editor moves into its widget and back with the same draft, DOM and modal ownership", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div><main></main><aside></aside>', { pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const doc = dom.window.document; const workspace = doc.querySelector("main")!; const overlay = doc.querySelector("aside")!;
  const root = createRoot(doc.getElementById("root")!); let mounts = 0;
  function Editor() {
    const [draft] = useState(() => { mounts++; return "Original"; });
    const [prompt, setPrompt] = useState(false);
    return <><textarea aria-label="Draft" defaultValue={draft} /><button onClick={() => setPrompt(true)}>Save</button>
      {prompt && <DialogCore placement="center" ariaLabel="Save confirmation" onDismiss={() => setPrompt(false)} portal>Confirm save</DialogCore>}</>;
  }
  const render = (target: HTMLElement | null) => flushSync(() => root.render(<AppSurface workspace={workspace} overlay={target}><Editor /></AppSurface>));
  try {
    render(null); const input = workspace.querySelector("textarea")!; input.value = "Unsaved edit";
    render(overlay); expect(overlay.querySelector("textarea")).toBe(input); expect(input.value).toBe("Unsaved edit"); expect(workspace.querySelector("textarea")).toBeNull();
    flushSync(() => overlay.querySelector("button")!.click());
    expect(doc.querySelector('[aria-label="Save confirmation"]')!.parentElement!.style.zIndex).toBe("2150");
    flushSync(() => doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(doc.querySelector('[aria-label="Save confirmation"]')).toBeNull();
    render(null); expect(workspace.querySelector("textarea")).toBe(input); expect(input.value).toBe("Unsaved edit"); expect(mounts).toBe(1);
  } finally { flushSync(() => root.unmount()); }
});
