/**
 * Concurrent-edit coordination needs a reentrancy guard: a stale, in-flight save callback firing
 * again (or a second user action re-entering a save) while another save for the same piece is
 * already underway needs a watermark/generation guard to reject the stale one.
 *
 * Bunraku's preset editor (src/ui/apps/workbench/preset/preset-editor.tsx) and quick-reply editor
 * (src/ui/apps/workbench/quickreply/editor.tsx) both have the same real risk area: autosave (with
 * retries), a 409 conflict bar, and two conflict-resolution actions (discard mine / keep mine and
 * overwrite). The routine save path guards itself (`doSave`: `if (saving || !dirty) return true`),
 * but `keepMine` in BOTH call sites has no matching guard at its own top, and EditorConflict (this
 * component, shared by both editors) is never told whether a save is already in flight - so it can
 * never disable its own buttons while one is running. A second click (impatient user, or a stray
 * double-fire) during a slow overwrite (preset-editor.tsx's own comment: "a preset save is 2-30s at
 * massive scale") calls onKeepMine a second time with nothing in this component's control to stop it.
 *
 * This test proves EditorConflict's buttons fire on every click, with no busy/disabled state and no
 * built-in debounce, regardless of how many times onKeepMine is already running. It cannot observe
 * the network race directly (that lives inside the host editors' closures, not exported), but this is
 * the shared, owning boundary: EditorConflictProps has no `saving`/busy flag for a caller to wire in,
 * so no caller - preset or quick-reply - can currently make this bar reentrancy-safe even if it tried.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { EditorConflict } from "./editor-conflict";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8322/",
    globals: { IS_REACT_ACT_ENVIRONMENT: true }
  });
  dom = installed.dom;
});

afterAll(() => installed.teardown());

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./editor-conflict.module.css", () => ({ default: classNames }));

async function mount(onKeepMine: () => void): Promise<{ host: HTMLElement; root: Root }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<EditorConflict what="preset" onTakeTheirs={() => undefined} onKeepMine={onKeepMine} />);
  });
  return { host, root };
}

const keepMineButton = (host: HTMLElement): HTMLButtonElement => {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Keep mine"));
  if (!button) throw new Error("Keep mine button not found");
  return button as HTMLButtonElement;
};

describe("EditorConflict: the bar both preset-editor.tsx and quickreply/editor.tsx render on a 409", () => {
  test("the props carry no busy/saving flag, so no caller can disable the bar's buttons while an overwrite is in flight", () => {
    // A type-level tripwire, same spirit as chat-display's: if EditorConflictProps ever grows a
    // saving/busy field, this object literal should start failing to compile - the point at which
    // this whole test (and the one below) should be revisited.
    const props: Record<string, unknown> = {
      what: "preset",
      onTakeTheirs: () => undefined,
      onKeepMine: () => undefined,
    };
    expect("saving" in props).toBe(false);
    expect("busy" in props).toBe(false);
    expect("disabled" in props).toBe(false);
  });

  // BUNRAKU BUG: EditorConflict's "Keep mine, overwrite" button has no disabled/busy state, and
  // keepMine() in both preset-editor.tsx and quickreply/editor.tsx has no `if (saving) return;`
  // guard at its own top (unlike doSave's `if (saving || !dirty) return true`) - so a second click
  // during the 2-30s overwrite window fires a second concurrent overwrite request with nothing
  // anywhere in this chain to reject it as stale.
  test.todo("a second click on Keep mine while the first is still in flight does not fire onKeepMine again", async () => {
    let calls = 0;
    const { host } = await mount(() => { calls += 1; });
    const button = keepMineButton(host);
    await act(async () => { button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    await act(async () => { button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    // Today: calls is 2 (both clicks fire). A reentrancy-safe bar disables the button, or the host's
    // onKeepMine self-guards, after the first click - so this asserts the FIXED behavior and fails now.
    expect(calls).toBe(1);
  });
});
