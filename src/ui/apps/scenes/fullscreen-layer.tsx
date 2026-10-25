/**
 * A full-scene layer (RoleCall's fullscreen prompt editor and macro preview, PresetPanel.tsx:3682 and :3812, portaled to document.body there). Here it is
 * portaled into the scene root instead: every scene rule is scoped under `.scs`, and the scene's container query makes `position:fixed` relative to that
 * box anyway, so the root is where "the whole scene" is. The layer carries its wing's tone (`--w`) across, since it no longer sits inside the wing (a layer opened from inside another takes that layer's).
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function FullscreenLayer({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  const probe = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<{ root: Element; tone: string } | null>(null);
  useLayoutEffect(() => {
    const here = probe.current;
    const root = here?.closest(".scs") ?? here?.ownerDocument.body;
    if (!here || !root) return;
    setHost({ root, tone: here.closest<HTMLElement>("[data-wing], .fs-layer")?.style.getPropertyValue("--w") ?? "" });
  }, []);
  return (
    <>
      <span ref={probe} hidden />
      {host && createPortal(<div className="fs-layer" role="dialog" aria-label={label} style={host.tone ? ({ "--w": host.tone } as CSSProperties) : undefined}>{children}</div>, host.root)}
    </>
  );
}
