/**
 * Keeps a visited program alive while its surface comes and goes. A program's body is rendered once, by the shell, into its own DOM node (the holder); the surface that is open (the side
 * panel, the popout, the layer) appends that node into its body and gives it back when it closes. So a Layer, which must unmount to release its focus trap and Escape, and a Side panel
 * swapped for another, never lose a draft: the program was never inside them as React children. The holder is created once per program id and dropped with the program.
 */
import { useCallback, useLayoutEffect, useRef, type JSX, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type HolderOf = (programId: string) => HTMLDivElement;

export function useProgramHolders(): HolderOf {
  const held = useRef(new Map<string, HTMLDivElement>());
  return useCallback((programId: string): HTMLDivElement => {
    let node = held.current.get(programId);
    if (!node) {
      node = document.createElement("div");
      node.className = "msn-prog";
      node.dataset["program"] = programId;
      held.current.set(programId, node);
    }
    return node;
  }, []);
}

/** The open surface's slot for one program: the holder sits here while this is mounted. */
export function ProgramSlot({ holder }: { holder: HTMLElement }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = host.current;
    if (!box) return undefined;
    box.appendChild(holder);
    return () => { if (holder.parentNode === box) box.removeChild(holder); };
  }, [holder]);
  return <div ref={host} className="msn-slot" data-part="scene.messenger.program.slot" />;
}

/** Renders each visited program into its holder, wherever the holder currently sits. */
export function ProgramPortals<P extends { id: string }>({ ids, programs, holderOf, render }: { ids: readonly string[]; programs: readonly P[]; holderOf: HolderOf; render(program: P): ReactNode }): JSX.Element {
  return <>{ids.map((id) => { const p = programs.find((q) => q.id === id); return p ? createPortal(render(p), holderOf(id), id) : null; })}</>;
}
