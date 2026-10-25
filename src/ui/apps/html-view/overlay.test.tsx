/** A saved-page widget must reach the existing sealed viewer through the real kind/id read contract. */
import { afterAll, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";
import { PieceStore } from "../../_shared/piece-store";
import { HtmlView } from "./index";
import { OverlayWidgets } from "./overlay";

afterAll(teardownAllDoms);
test("selecting a saved page requests its canonical kind and id and draws the sealed preview", async () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { url: "http://localhost/", observers: true,
    extraGlobals: ["CustomEvent", "sessionStorage", "DOMParser"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom.window.sessionStorage.clear();
  const pieces = new PieceStore(); pieces.replace([{ id: "page & one", kind: "htmldoc", name: "Saved drawing" }]);
  const requests: string[] = [];
  const ctx = { pieces, setStatus: () => {}, api: { getEntity: async (query: string) => {
    requests.push(query); const params = new URLSearchParams(query);
    if (params.get("kind") !== "htmldoc" || params.get("id") !== "page & one") throw new Error("invalid canonical read query");
    return { body: { name: "Saved drawing", html: "<h1>Actual drawing</h1>" } };
  } } } as unknown as AppContext;
  const host = dom.window.document.getElementById("root")!; const root = createRoot(host);
  try {
    await act(async () => root.render(<><HtmlView ctx={ctx} /><OverlayWidgets ctx={ctx} onActivate={() => {}} /></>));
    await act(async () => [...host.querySelectorAll("li button")][0]!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    expect(requests).toHaveLength(1);
    const frame = host.querySelector("iframe"); expect(frame).not.toBeNull();
    expect(frame!.getAttribute("sandbox")).toBe(""); expect(frame!.getAttribute("srcdoc")).toContain("Actual drawing");
  } finally { await act(async () => root.unmount()); }
});
