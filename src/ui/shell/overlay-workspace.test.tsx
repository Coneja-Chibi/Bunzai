/** Public overlay journeys preserve the original canvas, editor focus, drafts and remembered workspace. */
import { afterAll, expect, test } from "bun:test";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { AppContext, BunzaiApp } from "../app-contract";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { ACTIVE_APP_KEY } from "../_shared/window-memory";
import { NavigationOverlay } from "./NavigationOverlay";
import { AppRooms } from "./AppRooms";
import { useShellStore } from "./store";
import { presentedAppId } from "./store-navigation";

afterAll(teardownAllDoms);
test("Escape returns to the unchanged canvas; reopening keeps the widget draft; only promotion changes the workspace", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true, extraGlobals: ["sessionStorage", "DOMParser", "SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const doc = dom.window.document; const original = useShellStore.getState(); const root = createRoot(doc.getElementById("root")!);
  const manifest = { id: "library", title: "Library", markSvg: "", accent: "", order: 1 };
  const library: BunzaiApp = { manifest, Component: () => <input aria-label="Library search" defaultValue="Library filter" /> };
  const editor: BunzaiApp = { manifest: { ...manifest, id: "editor", title: "Editor", editsPieces: true }, Component: () => <textarea aria-label="Draft" defaultValue="Original" /> };
  const apps = [library, editor];
  const ctx = { agent: { publish() {} } } as unknown as AppContext;
  function Harness() {
    const state = useShellStore(); const [workspace, setWorkspace] = useState<HTMLElement | null>(null); const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
    const id = presentedAppId(state);
    return <><NavigationOverlay onNavigate={() => {}} onSurfaceTarget={setOverlay} /><main ref={setWorkspace} />
      <AppRooms app={apps.find((app) => app.manifest.id === id)!} activeAppId={id} workspaceAppId={state.activeAppId} overlayAppId={state.overlayAppId} overlayOpen={state.overlayOpen} workspace={workspace} overlay={overlay} ctx={ctx} /></>;
  }
  const click = (label: string) => flushSync(() => [...doc.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === label)!.click());
  const escape = () => flushSync(() => doc.querySelector<HTMLInputElement>('input[aria-label="Find an app"]')!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  try {
    useShellStore.setState({ manifests: apps.map((app) => app.manifest), activeAppId: "library", overlayOpen: false, overlayAppId: "", overlayPanes: null });
    dom.window.sessionStorage.setItem(ACTIVE_APP_KEY, "library");
    flushSync(() => root.render(<Harness />));
    const search = doc.querySelector<HTMLInputElement>('[aria-label="Library search"]')!; search.value = "Keep this filter";
    flushSync(() => doc.body.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }))); click("EditorApp");
    const draft = doc.querySelector<HTMLTextAreaElement>('textarea')!; draft.value = "Unsaved widget edit";
    expect(draft.closest('[aria-label="Studio overlay"]')).not.toBeNull();
    expect(search.closest("main")).not.toBeNull();
    escape();
    expect(doc.querySelector("main input")).toBe(search); expect(search.value).toBe("Keep this filter");
    expect(draft.closest("[hidden]")).not.toBeNull(); expect(useShellStore.getState().activeAppId).toBe("library");
    expect(dom.window.sessionStorage.getItem(ACTIVE_APP_KEY)).toBe("library");
    flushSync(() => doc.body.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })));
    expect(doc.querySelector('[aria-label="Studio overlay"] textarea')).toBe(draft); expect(draft.value).toBe("Unsaved widget edit");
    click("Open full workspace");
    expect(doc.querySelector("main textarea")).toBe(draft); expect(useShellStore.getState().activeAppId).toBe("editor");
    expect(dom.window.sessionStorage.getItem(ACTIVE_APP_KEY)).toBe("editor");
  } finally { flushSync(() => root.unmount()); useShellStore.setState(original); }
});

test("widget editor focus and split stay separate; removal reconciles both destinations", () => {
  const original = useShellStore.getState();
  const first = { id: "one", kind: "character", name: "One" }; const second = { id: "two", kind: "character", name: "Two" };
  try {
    useShellStore.setState({ manifests: [{ id: "editor", title: "Editor", editsPieces: true, markSvg: "", accent: "", order: 1 }], activeAppId: "editor", openPieces: [first, second], activeKey: "character:one", splitKey: "", overlayOpen: false, overlayAppId: "", overlayPanes: null, patchSettings() {} });
    const store = useShellStore.getState(); store.openOverlay(); store.openBeside(second);
    expect(useShellStore.getState().activeKey).toBe("character:one"); expect(useShellStore.getState().splitKey).toBe("");
    expect(store.besidePiece()?.id).toBe("two");
    store.focusPiece("two", "character"); store.closeOverlay();
    expect(store.activePiece()?.id).toBe("one"); expect(store.besidePiece()).toBeNull();
    store.openOverlay(); expect(store.activePiece()?.id).toBe("two");
    store.removePiece("two", "character");
    expect(store.activePiece()?.id).toBe("one"); store.promoteOverlay();
    expect(useShellStore.getState().activeKey).toBe("character:one"); expect(useShellStore.getState().splitKey).toBe("");
  } finally { useShellStore.setState(original); }
});
