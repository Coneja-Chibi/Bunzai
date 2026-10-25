/** The watchdog's rules against a modelled page: what hides or covers a protected surface is blamed on the mod, nothing else is. */
import { describe, expect, test } from "bun:test";
import { modOffenses, offenses, type Box, type Probe, type StyleView } from "./protected-watchdog";

const CLEAN: StyleView = { display: "block", visibility: "visible", opacity: "1", filter: "none", clipPath: "none", maskImage: "none", mixBlendMode: "normal", pointerEvents: "auto", position: "static", content: "none", width: "100px", height: "100px", fontSize: "16px" };
interface Node { name: string; parent?: Node; host?: Partial<StyleView>; mod?: Partial<StyleView>; box: Box; modBox?: Box; before?: { host?: Partial<StyleView>; mod?: Partial<StyleView> }; after?: { host?: Partial<StyleView>; mod?: Partial<StyleView> } }
const VIEW = { width: 1000, height: 800 };

/** A page model: `modOn` switches the mod's overrides, order in `nodes` is paint order (last is on top). */
function page(nodes: Node[], surfaces: Node[], topLayer: Node[] = [], clip?: (n: Node) => Box | null): { probe: Probe; setMod(on: boolean): void; enabled(): boolean; scans(): number } {
  let on = true;
  let scans = 0;
  const style = (n: Node, pseudo?: "::before" | "::after"): StyleView => {
    const part = pseudo === "::before" ? n.before : pseudo === "::after" ? n.after : { host: n.host, mod: n.mod };
    return { ...CLEAN, ...(part?.host ?? {}), ...(on ? part?.mod ?? {} : {}) };
  };
  const within = (outer: Node, inner: Node): boolean => { for (let n: Node | undefined = inner; n; n = n.parent) if (n === outer) return true; return false; };
  const probe: Probe = {
    surfaces: () => surfaces as unknown as Element[],
    all: () => { scans++; return nodes as unknown as Element[]; },
    topLayer: (el) => topLayer.includes(el as unknown as Node),
    parent: (el) => ((el as unknown as Node).parent ?? null) as unknown as Element | null,
    contains: (a, b) => within(a as unknown as Node, b as unknown as Node),
    style: (el, pseudo) => style(el as unknown as Node, pseudo),
    box: (el) => { const n = el as unknown as Node; return on && n.modBox ? n.modBox : n.box; },
    visibleBox: (el) => { const n = el as unknown as Node; return clip?.(n) ?? (on && n.modBox ? n.modBox : n.box); },
    hit: (x, y) => {
      for (const n of [...nodes].reverse()) {
        const s = style(n), b = on && n.modBox ? n.modBox : n.box;
        if (s.display === "none" || s.pointerEvents === "none" || x < b.left || y < b.top || x > b.left + b.width || y > b.top + b.height) continue;
        return n as unknown as Element;
      }
      return null;
    },
    viewport: () => VIEW,
  };
  return { probe, setMod: (v) => { on = v; }, enabled: () => on, scans: () => scans };
}
const root: Node = { name: "html", box: { left: 0, top: 0, width: 1000, height: 800 } };
const body: Node = { name: "body", parent: root, box: root.box };
const gate: Node = { name: "gate", parent: body, box: { left: 300, top: 200, width: 400, height: 300 } };
const scene = (extra: Node[] = []) => page([root, body, gate, ...extra], [gate]);
const blamed = (p: ReturnType<typeof page>): string[] => [...new Set(modOffenses(p.probe, p.setMod).map((o) => o.kind))].sort();

describe("protected watchdog", () => {
  describe("a surface taller than what shows of it", () => {
    // a mod that scales text makes the manager taller than the window: its bottom corners are scrolled away, and the host's own footer is what sits there
    const footer: Node = { name: "footer", parent: body, box: { left: 0, top: 760, width: 1000, height: 40 } };
    const tall = (): Node => ({ ...gate, modBox: { left: 300, top: 200, width: 400, height: 900 } });
    test("points beyond the visible part are not hit-tested, so the host footer is not a cover", () => {
      const g = tall();
      const p = page([root, body, g, footer], [g], [], (n) => (n === g ? { left: 300, top: 200, width: 400, height: 560 } : null));
      expect(blamed(p)).toEqual([]);
    });
    test("control: with no clipping known the same page reads as covered", () => {
      const g = tall();
      expect(blamed(page([root, body, g, footer], [g]))).toContain("covered");
    });
    test("a surface clipped to nothing is a size offense", () => {
      const g = tall();
      expect(offenses(page([root, body, g], [g], [], () => ({ left: 300, top: 200, width: 400, height: 2 })).probe).map((o) => o.kind)).toContain("size");
    });
  });

  describe("overlays smaller than the viewport", () => {
    const dot = (over: Partial<Node> = {}): Node => ({ name: "dot", parent: body, box: { left: 560, top: 260, width: 90, height: 90 }, host: { display: "none" }, mod: { display: "block", position: "absolute" }, ...over });
    test("a small positioned element on top of an inline surface is blamed on the mod", () => {
      expect(blamed(scene([dot()]))).toContain("overlay-over");
    });
    test("a host widget the mod's layout pushed onto the surface is the mod's layout, not a cover it drew: not blamed", () => {
      const widget = dot({ host: { position: "fixed", display: "block" }, mod: undefined, box: { left: 10, top: 10, width: 90, height: 90 }, modBox: { left: 560, top: 260, width: 90, height: 90 } });
      const p = scene([widget]);
      expect(offenses(p.probe).map((o) => o.kind)).toContain("overlay-over");
      expect(blamed(p)).toEqual([]);
    });
    test("the same element painted under the surface is not (the middle of the overlap hits the surface)", () => {
      expect(blamed(page([root, body, dot(), gate], [gate]))).toEqual([]);
    });
    test("a small positioned element that does not touch the surface is left alone", () => {
      expect(blamed(scene([dot({ box: { left: 10, top: 10, width: 90, height: 90 } })]))).toEqual([]);
    });
    test("a surface in the top layer is not scanned at all: nothing can cover it, so the element scan is skipped", () => {
      const p = page([root, body, gate, dot()], [gate], [gate]);
      expect(modOffenses(p.probe, p.setMod)).toEqual([]);
      expect(p.scans()).toBe(0);
      const inline = page([root, body, gate, dot()], [gate]);
      modOffenses(inline.probe, inline.setMod);
      expect(inline.scans()).toBeGreaterThan(0);
    });
    test("a top-layer surface is still checked on its path: a hidden ancestor removes a dialog too", () => {
      body.mod = { display: "none" };
      try { expect(blamed(page([root, body, gate], [gate], [gate]))).toContain("display"); } finally { delete body.mod; }
    });
    test("one inline surface among top-layer ones brings the scan back", () => {
      const inline: Node = { name: "inline", parent: body, box: { left: 0, top: 0, width: 200, height: 100 } };
      const p = page([root, body, gate, inline], [gate, inline], [gate]);
      modOffenses(p.probe, p.setMod);
      expect(p.scans()).toBeGreaterThan(0);
    });
  });

  test("a clean page has no offenses and the mod is left switched on", () => {
    const p = scene();
    expect(offenses(p.probe)).toEqual([]);
    expect(blamed(p)).toEqual([]);
    expect(p.enabled()).toBe(true);
  });

  test("no protected surface mounted means nothing to check", () => {
    const p = page([root, body], []);
    body.mod = { display: "none" };
    try { expect(blamed(p)).toEqual([]); } finally { delete body.mod; }
  });

  const attacks: [string, () => ReturnType<typeof page>, string][] = [
    ["body{display:none}", () => { const p = scene(); body.mod = { display: "none" }; return p; }, "display"],
    ["body{opacity:0}", () => { const p = scene(); body.mod = { opacity: "0" }; return p; }, "opacity"],
    ["html{visibility:hidden}", () => { const p = scene(); root.mod = { visibility: "hidden" }; return p; }, "visibility"],
    ["body{filter:blur(40px)}", () => { const p = scene(); body.mod = { filter: "blur(40px)" }; return p; }, "filter"],
    ["body{clip-path:inset(100%)}", () => { const p = scene(); body.mod = { clipPath: "inset(100%)" }; return p; }, "clip"],
    ["body{mix-blend-mode:difference}", () => { const p = scene(); body.mod = { mixBlendMode: "difference" }; return p; }, "blend"],
    ["body{mask-image:linear-gradient(transparent,transparent)}", () => { const p = scene(); body.mod = { maskImage: "linear-gradient(transparent, transparent)" }; return p; }, "mask"],
    ["html{font-size:0}", () => { const p = scene(); root.mod = { fontSize: "0px" }; return p; }, "font-size"],
    ["full-screen fixed overlay", () => { const o: Node = { name: "overlay", parent: body, box: root.box, host: { display: "none" }, mod: { display: "block", position: "fixed" } }; return scene([o]); }, "covered"],
    ["full-screen overlay that passes clicks through", () => { const o: Node = { name: "veil", parent: body, box: root.box, host: { display: "none" }, mod: { display: "block", position: "fixed", pointerEvents: "none" } }; return scene([o]); }, "overlay"],
    ["body::after{position:fixed;inset:0;pointer-events:none}", () => { body.after = { mod: { content: '""', position: "fixed", width: "1000px", height: "800px", pointerEvents: "none" } }; return scene(); }, "overlay::after"],
    ["gate shrunk to nothing", () => { const g: Node = { ...gate, modBox: { ...gate.box, width: 0, height: 0 } }; return page([root, body, g], [g]); }, "size"],
    ["gate pushed off screen", () => { const g: Node = { ...gate, modBox: { left: 5000, top: 5000, width: 400, height: 300 } }; return page([root, body, g], [g]); }, "size"],
    ["gate pointer-events:none", () => { const p = scene(); gate.mod = { pointerEvents: "none" }; return p; }, "pointer-events"],
  ];
  for (const [name, build, kind] of attacks) {
    test(`${name} is blamed on the mod, which is switched back on for the caller to drop`, () => {
      delete root.mod; delete body.mod; delete gate.mod; delete body.after;
      const p = build();
      try {
        expect(blamed(p)).toContain(kind);
        expect(p.enabled()).toBe(true);
      } finally { delete root.mod; delete body.mod; delete gate.mod; delete body.after; }
    });
  }

  test("a host scrim or a host fade that fails the same way with the mod off is not blamed", () => {
    const scrim: Node = { name: "scrim", parent: body, box: root.box, host: { position: "fixed" } };
    const faded: Node = { ...gate, host: { opacity: "0.1" } };
    const p = page([root, body, faded, scrim], [faded]);
    expect(offenses(p.probe).length).toBeGreaterThan(0);
    expect(blamed(p)).toEqual([]);
  });


  test("a decorative theme overlay does not revoke for a host-hidden control", () => {
    const hidden: Node = { ...gate, host: { display: "none" } };
    const decoration: Node = { name: "decoration", parent: body, box: root.box, host: { display: "none" }, mod: { display: "block", position: "absolute", pointerEvents: "none" } };
    const p = page([root, body, hidden, decoration], [hidden]);
    expect(blamed(p)).toEqual([]);
  });

  test("a host-hidden control does not make a harmless ancestor filter a theme fault", () => {
    const hidden: Node = { ...gate, host: { display: "none" } };
    body.mod = { filter: "blur(1px)" };
    try { expect(blamed(page([root, body, hidden], [hidden]))).toEqual([]); }
    finally { delete body.mod; }
  });

  test("a hidden host control never exempts a visible control from mod protection", () => {
    const hidden: Node = { ...gate, host: { display: "none" } };
    const visible: Node = { ...gate, name: "visible", box: { left: 100, top: 100, width: 100, height: 100 } };
    body.mod = { opacity: "0" };
    try { expect(blamed(page([root, body, hidden, visible], [hidden, visible]))).toContain("opacity"); }
    finally { delete body.mod; }
  });

  test("a host-hidden surface plus a mod that also hides it adds nothing new for the mod to answer for", () => {
    const hidden: Node = { ...gate, host: { display: "none" } };
    const p = page([root, body, hidden], [hidden]);
    body.mod = { opacity: "0" };
    try { expect(blamed(p)).toEqual([]); } finally { delete body.mod; }
  });
});
