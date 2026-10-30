/**
 * Coming back to the window must not flash the default theme. Focus and visibility revalidate the
 * effective theme, and the chosen one stays painted until the host's answer arrives (a failed answer
 * still falls back to the core theme, inside appearance-requests.ts).
 */
import { afterAll, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { installDom } from "../_shared/test-dom";
import { CORE_THEME_APPEARANCE } from "./theme";
import { useShellStore } from "./store";
import { useThemeChangeStream } from "./use-theme-events";

const installed = installDom(undefined, { extraGlobals: ["Event", "HTMLMetaElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
afterAll(() => installed.teardown());

function Harness(): null {
  useThemeChangeStream(true);
  return null;
}

test("a focus revalidation keeps the chosen theme on screen while the host answers", async () => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  const meta = document.createElement("meta");
  meta.setAttribute("name", "vaude-session");
  meta.setAttribute("content", "token");
  document.head.append(meta);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => new Promise<Response>(() => undefined)) as unknown as typeof fetch; // the host is slow
  const chosen = { ...CORE_THEME_APPEARANCE, themeId: "rolecall" } as typeof CORE_THEME_APPEARANCE;
  useShellStore.setState({ appearance: chosen });

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Harness />));
  await act(async () => { window.dispatchEvent(new Event("focus")); });

  expect(useShellStore.getState().appearance).toBe(chosen);
  await act(async () => root.unmount());
  globalThis.fetch = realFetch;
  meta.remove();
  host.remove();
});
