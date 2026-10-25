/** Switching tools must retain the editor's dirty draft without letting the hidden editor replace the active screen brief. */
import { afterAll, expect, test } from "bun:test";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import type { AppContext, BunrakuApp } from "../app-contract";
import { AppRooms } from "./AppRooms";
import { useShellStore } from "./store";

afterAll(teardownAllDoms);
test("an editor survives visiting a tool, including the asynchronous loading gap", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const host = dom.window.document.getElementById("root")!; const root = createRoot(host); const original = useShellStore.getState();
  let mounts = 0; let publishFromEditor = () => {}; let publications = 0;
  const ctx = { agent: { publish: () => { publications++; } } } as unknown as AppContext;
  const editor: BunrakuApp = { manifest: { id: "editor", title: "Editor", editsPieces: true, markSvg: "", accent: "", order: 1 }, Component: ({ ctx }) => {
    useState(() => { mounts++; return null; }); publishFromEditor = () => ctx.agent.publish({ headline: "Editor" });
    return <textarea defaultValue="Original" />;
  } };
  const tool: BunrakuApp = { manifest: { ...editor.manifest, id: "tool", editsPieces: false }, Component: () => <button>Tool</button> };
  const render = (app: BunrakuApp | null, id: string) => flushSync(() => { useShellStore.setState({ activeAppId: id }); root.render(<AppRooms app={app} activeAppId={id} workspaceAppId={id} overlayAppId="" workspace={host} overlay={null} overlayOpen={false} ctx={ctx} />); });
  try {
    render(editor, "editor"); const input = host.querySelector("textarea")!; input.value = "Unsaved";
    render(null, "tool"); expect(input.isConnected).toBe(true); expect(input.closest("[hidden]")).not.toBeNull();
    render(tool, "tool"); publishFromEditor(); expect(publications).toBe(0);
    render(editor, "editor"); expect(host.querySelector("textarea")).toBe(input); expect(input.value).toBe("Unsaved"); expect(input.closest("[hidden]")).toBeNull(); expect(mounts).toBe(1);
    expect(publications).toBe(1); // returning restores the retained editor's detailed brief
    publishFromEditor(); expect(publications).toBe(2);
  } finally { flushSync(() => root.unmount()); useShellStore.setState(original); }
});
