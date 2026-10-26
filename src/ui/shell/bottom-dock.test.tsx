/** RoleCall-style dock at the public boundary: discovered apps navigate, the Overlay tile opens the overlay, and Hide dock lasts only for the session. */
import { afterAll, expect, test } from "bun:test";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { Dock } from "./Dock";
import { TabStrip } from "./TabStrip";
import { useShellStore } from "./store";

afterAll(teardownAllDoms);
test("all available apps, including catalog-only tools, navigate directly without opening the overlay", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { extraGlobals: ["DOMParser", "SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const original = useShellStore.getState(); const root = createRoot(dom.window.document.getElementById("root")!); let navigations = 0;
  const manifest = { markSvg: "<svg/>", accent: "var(--accent)", order: 1 };
  try {
    useShellStore.setState({ manifests: [
      { ...manifest, id: "library", title: "The Library" },
      { ...manifest, id: "css", title: "CSS Workshop", catalogOnly: true },
      { ...manifest, id: "future", title: "Future", comingSoon: true },
    ], activeAppId: "library", overlayOpen: false, dockSlim: false });
    flushSync(() => root.render(<Dock onNavigate={() => { navigations++; }} />));
    const tool = [...dom.window.document.querySelectorAll("button")].find(button => button.textContent?.includes("CSS Workshop"));
    expect(tool !== undefined).toBe(true);
    flushSync(() => tool!.click());
    expect(useShellStore.getState().activeAppId).toBe("css"); expect(useShellStore.getState().overlayOpen).toBe(false); expect(navigations).toBe(1);
    expect(dom.window.document.querySelector('[aria-current="page"]')?.textContent).toContain("CSS Workshop");
    expect(dom.window.document.querySelector('[aria-label="Future"]')).toBeNull();
  } finally { flushSync(() => root.unmount()); useShellStore.setState(original); }
});

test("collapse removes app buttons from keyboard access and the visible handle restores them", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { extraGlobals: ["DOMParser", "SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const original = useShellStore.getState(); const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    useShellStore.setState({ manifests: [{ id: "library", title: "The Library", markSvg: "<svg/>", accent: "var(--accent)", order: 1 }], dockSlim: false,
      toggleDockSlim: () => useShellStore.setState(state => ({ dockSlim: !state.dockSlim })) });
    flushSync(() => root.render(<Dock />));
    const hide = dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Hide dock"]'); expect(hide !== null).toBe(true);
    hide!.focus();
    flushSync(() => hide!.click());
    expect(dom.window.document.querySelector('nav')?.hasAttribute("inert")).toBe(true);
    expect([...dom.window.document.querySelectorAll<HTMLButtonElement>('nav button')].every(button => button.tabIndex === -1)).toBe(true);
    const show = dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Show dock"]'); expect(show !== null).toBe(true);
    expect(dom.window.document.activeElement === show).toBe(true);
    flushSync(() => show!.click()); expect(dom.window.document.querySelector('[data-app-id="library"]')).not.toBeNull();
    expect(dom.window.document.querySelector('nav')?.hasAttribute("inert")).toBe(false);
    expect(dom.window.document.activeElement === dom.window.document.querySelector('[data-app-id="library"]')).toBe(true);
  } finally { flushSync(() => root.unmount()); useShellStore.setState(original); }
});

test("the Overlay tile opens the overlay without changing the active app", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { extraGlobals: ["DOMParser", "SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const original = useShellStore.getState(); const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    useShellStore.setState({ manifests: [{ id: "library", title: "The Library", markSvg: "<svg/>", accent: "var(--accent)", order: 1 }], activeAppId: "library", overlayOpen: false, dockSlim: false });
    flushSync(() => root.render(<Dock />));
    const tile = dom.window.document.querySelector<HTMLButtonElement>('[data-part="shell.nav.overlay"]'); expect(tile !== null).toBe(true);
    flushSync(() => tile!.click());
    expect(useShellStore.getState().overlayOpen).toBe(true); expect(useShellStore.getState().activeAppId).toBe("library");
  } finally { flushSync(() => root.unmount()); useShellStore.setState(original); }
});

test("Hide dock is never saved, and a saved hidden flag from an older version does not hide it on launch", () => {
  const original = useShellStore.getState(); const patches: unknown[] = [];
  try {
    useShellStore.setState({ dockSlim: false, patchSettings: (patch: unknown) => { patches.push(patch); } } as never);
    useShellStore.getState().toggleDockSlim();
    expect(useShellStore.getState().dockSlim).toBe(true); expect(patches).toEqual([]);
    useShellStore.setState({ dockSlim: false });
    useShellStore.getState().applySettings({ ...useShellStore.getState().settings, "shell.dockSlim": true });
    expect(useShellStore.getState().dockSlim).toBe(false);
  } finally { useShellStore.setState(original); }
});

test("the tab strip is absent with no open pieces and no pending update, and present once a piece opens", () => {
  const { dom } = installDom('<!doctype html><div id="root"></div>', { extraGlobals: ["DOMParser", "SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: false } });
  const original = useShellStore.getState(); const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    useShellStore.setState({ openPieces: [], devUpdate: null });
    flushSync(() => root.render(<TabStrip />));
    expect(dom.window.document.getElementById("tabstrip")).toBeNull();
    flushSync(() => useShellStore.setState({ openPieces: [{ id: "c1", kind: "character", name: "Vera" } as never], activeKey: "" }));
    expect(dom.window.document.getElementById("tabstrip")).not.toBeNull();
    expect(dom.window.document.body.textContent).not.toContain("Overlay");
  } finally { flushSync(() => root.unmount()); useShellStore.setState(original); }
});
