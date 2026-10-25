/** A cold picker owns focus and Escape before its lazy content resolves, retaining its app overlay. */
import { afterAll, expect, test } from "bun:test";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { installDom, teardownAllDoms } from "../../../_shared/test-dom";
import { DialogCore } from "../../../components/dialog-core";
import { EmojiPicker } from "./emoji-picker";

afterAll(teardownAllDoms);
test("Escape during cold loading closes only the picker and restores its trigger", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const doc = dom.window.document; const root = createRoot(doc.getElementById("root")!); let overlayCloses = 0; let pickerCloses = 0;
  let anchor: HTMLButtonElement | null = null;
  function Harness({ picker }: { picker: boolean }) {
    return <DialogCore placement="fullscreen" ariaLabel="App overlay" onDismiss={() => { overlayCloses++; }} portal>
      <button ref={(node) => { anchor = node; }}>Pick emoji</button>
      {picker && <EmojiPicker anchor={anchor} onPick={() => {}} onClose={() => { pickerCloses++; root.render(<Harness picker={false} />); }} />}
    </DialogCore>;
  }
  try {
    flushSync(() => root.render(<Harness picker={false} />)); anchor!.focus();
    flushSync(() => root.render(<Harness picker />));
    const picker = doc.querySelector('[aria-label="Pick an emoji"]')!;
    expect(picker.textContent).toBe("Loading..."); expect(doc.activeElement).toBe(picker);
    flushSync(() => picker.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(pickerCloses).toBe(1); expect(overlayCloses).toBe(0); expect(doc.activeElement).toBe(anchor);
    expect(doc.querySelector('[aria-label="App overlay"]')).not.toBeNull();
  } finally { flushSync(() => root.unmount()); }
});
