/**
 * The shell's client boot (ADR-008, CONTRACT V2) - mounts the React root and wires dev live-reload.
 * All shell behavior (settings, the dock, the Workbench's open pieces, the status bar, the
 * right-click system) lives in shell/App.tsx and shell/store.ts now; this file only bootstraps.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App, type AppProps } from "./shell/App";
import { LibraryGate } from "./shell/library-gate";
import { ShellErrorBoundary } from "./shell/error-boundary";
import { useShellStore } from "./shell/store";
import { PieceStore } from "./_shared/piece-store";
import { connectDevReload } from "./dev-reload";
import { SESSION_STALE_EVENT } from "./_shared/api-fetch";

// plain .ts (no JSX): createElement keeps this the one non-TSX file in the React tree
const mountNode = document.getElementById("shell-root");
if (!mountNode) throw new Error("boot: #shell-root missing from index.html");
// the boundary wraps App, never the other way round: a crash inside App must still leave something
// on screen to act on (see shell/error-boundary.tsx). The library gate sits between them: while the
// library is locked or loading in, it shows the stage door or the load-in instead of the Studio.
const pieces = new PieceStore();
const app = createElement<AppProps>(App, { pieces });
const gate = createElement(LibraryGate, { pieces, children: app });
createRoot(mountNode).render(createElement(ShellErrorBoundary, { children: gate }));
window.addEventListener(SESSION_STALE_EVENT, () => useShellStore.getState().offerDevUpdate("restart"));

// Keep SSE reconnecting, but never replace the person's live workspace without an explicit click.
// Packaged pages carry no dev marker and never request this endpoint.
if (document.querySelector('meta[name="vaude-dev"]')) {
  connectDevReload(new EventSource("/dev/reload"),
    (reason) => useShellStore.getState().offerDevUpdate(reason),
    (text) => useShellStore.getState().setStatus(text));
}
