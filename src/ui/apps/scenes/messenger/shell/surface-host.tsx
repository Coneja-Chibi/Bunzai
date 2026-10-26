/**
 * Draws the open program in the surface its kind names (shell/surfaces.ts): `DockedSurface` is the Side or Wide panel in the chat row (the chat reflows beside it, or under it below 1024px),
 * `FloatingSurface` is the Popout or the Layer over the whole Messenger. Each shows the program's holder (shell/program-holders.tsx) in its body, so the program's own state outlives the
 * frame. A program that can float (popout/wing-popouts.tsx) gets a Pop out action; while it floats the surface shows "is floating" in place of the holder, which sits in the floating
 * panel, so one program is drawn once. Presentational beyond that: which program is open, the pin and the close are the shell's.
 */
import { useEffect, useRef, type JSX, type ReactNode } from "react";
import type { AppContext } from "../../../../app-contract";
import { IconButton } from "../../../../components/button";
import { focusablesIn } from "../../../../_shared/focus-trap";
import { PopoutPlaceholder } from "../../popout/popout-panel";
import { usePopout } from "../../popout/popout-store";
import { popoutKindOfProgram } from "../../popout/wing-popouts";
import { Layer } from "../frames/layer";
import { Workshop, isWorkshopProgram, type WorkshopScene } from "../panels/workshop";
import { Popout } from "../frames/popout";
import { SidePanel } from "../frames/side-panel";
import type { Program } from "../programs";
import { ProgramSlot } from "./program-holders";
import { isDockedKind, surfaceOf } from "./surfaces";

interface HostProps {
  ctx: AppContext;
  program: Program;
  holder: HTMLElement;
  onClose(): void;
}

/** The program's body for this surface (the holder, or "is floating" while its pop-out is open) and its Pop out action, absent for a program that does not float. */
function useDocking(ctx: AppContext, program: Program, holder: HTMLElement, onClose: () => void): { body: ReactNode; onPopOut?: () => void } {
  const kind = popoutKindOfProgram(program.id);
  const po = usePopout(ctx, kind?.id ?? "panel.none");
  if (!kind) return { body: <ProgramSlot holder={holder} /> };
  return { body: po.state.open ? <PopoutPlaceholder kind={kind} onBack={po.close} /> : <ProgramSlot holder={holder} />, onPopOut: () => { po.open(); onClose(); } };
}

export function DockedSurface({ ctx, program, holder, pinned, onTogglePin, onClose }: HostProps & { pinned: boolean; onTogglePin(): void }): JSX.Element | null {
  const kind = surfaceOf(program.id);
  const box = useRef<HTMLDivElement>(null);
  const id = program.id;
  const dock = useDocking(ctx, program, holder, onClose);
  // Opening a panel moves focus to its first control (panels.html keyboard note).
  useEffect(() => { if (box.current) focusablesIn(box.current)[0]?.focus(); }, [id]);
  if (!isDockedKind(kind)) return null;
  return (
    <div ref={box} className="msn-dock">
      <SidePanel title={program.title} width={kind === "wide" ? "wide" : "side"} pinned={pinned} onTogglePin={onTogglePin} {...(dock.onPopOut ? { onPopOut: dock.onPopOut } : {})} onClose={onClose}>{dock.body}</SidePanel>
    </div>
  );
}

/** `workshop` is what the workshop layer shows of the scene; without it every layer is the plain titled page. */
export function FloatingSurface({ ctx, program, holder, onClose, workshop }: HostProps & { workshop?: WorkshopScene }): JSX.Element | null {
  const kind = surfaceOf(program.id);
  const dock = useDocking(ctx, program, holder, onClose);
  if (kind === "popout") return <Popout title={program.title} width={460} onClose={onClose}><ProgramSlot holder={holder} /></Popout>;
  if (kind !== "layer") return null;
  if (workshop && isWorkshopProgram(program.id)) return <Workshop program={program} holder={holder} scene={workshop} onClose={onClose} body={dock.body} {...(dock.onPopOut ? { onPopOut: dock.onPopOut } : {})} />;
  return (
    <Layer label={program.title} onClose={onClose}>
      <div className="msn-lyr" data-part="scene.messenger.layer.page">
        <header className="msn-lyr-h"><h2>{program.title}</h2>{dock.onPopOut && <IconButton data-part="scene.messenger.layer.popout" variant="quiet" size="sm" icon="lucide:external-link" label="Pop out" onClick={dock.onPopOut} />}</header>
        <div className="msn-lyr-b">{dock.body}</div>
      </div>
    </Layer>
  );
}
