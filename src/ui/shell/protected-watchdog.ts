/**
 * The protected-layer watchdog. A mod's styles may restyle anything, so while a `.host-protected` surface (lock,
 * recovery words, Kit Gate, theme manager) is on screen this looks for what would hide or cover it: a hidden,
 * transparent, filtered or clipped element on its path to the root, a surface that is off screen or tiny, an element
 * that eats pointer hits at its points, and a positioned element (or pseudo-element) over it. A surface in the browser top
 * layer (a modal dialog) cannot be covered by page content, so only the inline surfaces need the element scan.
 *
 * It only ever blames the mod. `offenses` runs once with the mod's styles on and once with them off; an offense
 * counts only if it is new with the mod on. A host surface that is legitimately mid-fade, or covered by the host's
 * own scrim, fails the same way both times and is left alone. The DOM is reached through a probe so the rules test
 * without a layout engine.
 */
export interface Box { left: number; top: number; width: number; height: number }
export interface StyleView { display: string; visibility: string; opacity: string; filter: string; clipPath: string; maskImage: string; mixBlendMode: string; pointerEvents: string; position: string; content: string; width: string; height: string; fontSize: string }
export interface Probe {
  /** Every mounted protected surface. */
  surfaces(): Element[];
  /** Every element, for the overlay scan. */
  all(): Element[];
  parent(el: Element): Element | null;
  contains(outer: Element, inner: Element): boolean;
  style(el: Element, pseudo?: "::before" | "::after"): StyleView;
  box(el: Element): Box;
  /** The part of the box a person could see: clipped by every scrolling or overflow-hidden ancestor and the viewport. */
  visibleBox(el: Element): Box;
  hit(x: number, y: number): Element | null;
  /** Whether the surface is in the browser top layer (an open modal dialog or popover), above all page content. */
  topLayer(el: Element): boolean;
  viewport(): { width: number; height: number };
}
export interface Offense { kind: string; node: unknown }

const MIN_SIDE = 8;
const MIN_FONT_PX = 8;
const COVER_SHARE = 0.5;
const inside = (probe: Probe, root: Element, el: Element): boolean => probe.contains(root, el);

function pathStyleOffenses(probe: Probe, surface: Element, out: Offense[]): void {
  for (let el: Element | null = surface; el; el = probe.parent(el)) {
    const s = probe.style(el);
    if (s.display === "none") out.push({ kind: "display", node: el });
    if (s.visibility === "hidden" || s.visibility === "collapse") out.push({ kind: "visibility", node: el });
    if (Number(s.opacity) < 0.5) out.push({ kind: "opacity", node: el });
    if (s.filter !== "none" && s.filter !== "") out.push({ kind: "filter", node: el });
    if (s.clipPath !== "none" && s.clipPath !== "") out.push({ kind: "clip", node: el });
    if (s.maskImage !== "none" && s.maskImage !== "") out.push({ kind: "mask", node: el });
    if (s.mixBlendMode !== "normal" && s.mixBlendMode !== "") out.push({ kind: "blend", node: el });
    if (parseFloat(s.fontSize) < MIN_FONT_PX) out.push({ kind: "font-size", node: el });
  }
  if (probe.style(surface).pointerEvents === "none") out.push({ kind: "pointer-events", node: surface });
}

function hitOffenses(probe: Probe, surface: Element, out: Offense[]): void {
  const { width: vw, height: vh } = probe.viewport();
  const b = probe.visibleBox(surface);
  const left = Math.max(0, b.left), top = Math.max(0, b.top), right = Math.min(vw, b.left + b.width), bottom = Math.min(vh, b.top + b.height);
  if (b.width < MIN_SIDE || b.height < MIN_SIDE || right - left < MIN_SIDE || bottom - top < MIN_SIDE) { out.push({ kind: "size", node: surface }); return; }
  const pad = Math.min(4, (right - left) / 4, (bottom - top) / 4);
  const points: [number, number][] = [[(left + right) / 2, (top + bottom) / 2], [left + pad, top + pad], [right - pad, top + pad], [left + pad, bottom - pad], [right - pad, bottom - pad]];
  for (const [x, y] of points) {
    const hit = probe.hit(x, y);
    if (!hit || !inside(probe, surface, hit)) out.push({ kind: "covered", node: hit });
  }
}

/** The point at the middle of where two boxes overlap, or null when they do not. */
function overlapCenter(a: Box, b: Box): [number, number] | null {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width), bottom = Math.min(a.top + a.height, b.top + b.height);
  return right - left >= 1 && bottom - top >= 1 ? [(left + right) / 2, (top + bottom) / 2] : null;
}

const positioned = (s: StyleView): boolean => (s.position === "fixed" || s.position === "absolute") && s.display !== "none" && s.visibility === "visible" && Number(s.opacity) > 0.05;

/**
 * A positioned element, visible, outside every protected surface, that is at least half the viewport ("overlay") or that is
 * the topmost thing at the middle of where it overlaps an inline surface ("overlay-over"); and a positioned pseudo-element at
 * least half the viewport. A pointer-events:none element under half the viewport is not seen: it is not hit, and paint order
 * is unknown. modOffenses drops an "overlay-over" whose element was positioned and visible without the mod too: a host
 * widget a mod's layout pushed onto the surface is the mod's layout, not a cover it drew.
 */
function overlayOffenses(probe: Probe, surfaces: Element[], out: Offense[]): void {
  const inline = surfaces.filter((surface) => !probe.topLayer(surface));
  if (inline.length === 0) return;
  const { width: vw, height: vh } = probe.viewport();
  const covers = (box: Box): boolean => box.width * box.height >= vw * vh * COVER_SHARE;
  const coversInline = (el: Element, box: Box): boolean => inline.some((surface) => {
    const at = overlapCenter(box, probe.box(surface));
    const top = at ? probe.hit(at[0], at[1]) : null;
    return top !== null && probe.contains(el, top);
  });
  for (const el of probe.all()) {
    if (surfaces.some((surface) => inside(probe, surface, el))) continue;
    const real = probe.style(el);
    const ancestor = surfaces.some((surface) => inside(probe, el, surface));
    if (!ancestor && positioned(real)) {
      const box = probe.box(el);
      if (covers(box)) out.push({ kind: "overlay", node: el });
      else if (coversInline(el, box)) out.push({ kind: "overlay-over", node: el });
    }
    for (const pseudo of ["::before", "::after"] as const) {
      const p = probe.style(el, pseudo);
      if (p.content === "none" || p.content === "normal" || p.display === "none" || (p.position !== "fixed" && p.position !== "absolute") || Number(p.opacity) <= 0.05) continue;
      if (parseFloat(p.width) * parseFloat(p.height) >= vw * vh * COVER_SHARE) out.push({ kind: "overlay" + pseudo, node: el });
    }
  }
}

/** Everything that currently hides or covers a protected surface. Empty when none is mounted. The overlay scan reads every element, so callers run it on mount and when the page changes, never on a timer. */
export function offenses(probe: Probe, scanOverlays = true): Offense[] {
  const surfaces = probe.surfaces();
  if (surfaces.length === 0) return [];
  const out: Offense[] = [];
  for (const surface of surfaces) { pathStyleOffenses(probe, surface, out); hitOffenses(probe, surface, out); }
  if (scanOverlays) overlayOffenses(probe, surfaces, out);
  return out;
}


/** Eligibility comes from the host-only baseline, so a mod cannot exempt a control by hiding it. */
function hostVisible(probe: Probe, surface: Element): boolean {
  for (let el: Element | null = surface; el; el = probe.parent(el)) {
    const style = probe.style(el);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  }
  const box = probe.visibleBox(surface), viewport = probe.viewport();
  return box.width > 0 && box.height > 0 && box.left < viewport.width && box.top < viewport.height &&
    box.left + box.width > 0 && box.top + box.height > 0;
}

/** The offenses only the mod causes: present with its styles on, absent with them off. */
export function modOffenses(probe: Probe, setModEnabled: (on: boolean) => void, scanOverlays = true): Offense[] {
  const withMod = offenses(probe, scanOverlays);
  if (withMod.length === 0) return [];
  setModEnabled(false);
  let baseline: Offense[], eligible: Element[], hostPositioned: Set<unknown>;
  try {
    eligible = probe.surfaces().filter((surface) => hostVisible(probe, surface));
    const scoped = { ...probe, surfaces: () => eligible };
    baseline = offenses(scoped, scanOverlays);
    hostPositioned = new Set(withMod.filter((o) => o.kind === "overlay-over" && positioned(probe.style(o.node as Element))).map((o) => o.node));
  } finally { setModEnabled(true); }
  const checked = eligible.length === probe.surfaces().length ? withMod : offenses({ ...probe, surfaces: () => eligible }, scanOverlays);
  return checked.filter((o) => !baseline.some((b) => b.kind === o.kind && b.node === o.node) && !(o.kind === "overlay-over" && hostPositioned.has(o.node)));
}
