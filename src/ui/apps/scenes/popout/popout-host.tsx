/**
 * The two ends of a pop-out. PopoutHost is mounted once per scene, beside the wing panel inside `.scs` (not inside a wing, so a panel
 * outlives the wing it came from; RoleCall's dies with it, which is why VVS-683 needed `data-wing-panel-ignore-outside`). It draws each
 * kind it is given at most once, which is the "one panel per kind per scene" rule. PopoutSlot is the docked spot: the kind's content
 * with its Pop out button, or the placeholder while the panel floats.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../app-contract";
import type { Box } from "./popout-core";
import type { PopoutKind } from "./popout-kind";
import { PopoutPanel, PopoutPlaceholder } from "./popout-panel";
import { usePopout } from "./popout-store";

function Floating({ kind, ctx, chat, view, onChat }: { kind: PopoutKind; ctx: AppContext; chat: Chat; view: Box; onChat?: (chat: Chat) => void }): JSX.Element | null {
  const po = usePopout(ctx, kind.id);
  return po.state.open ? <PopoutPanel kind={kind} c={{ ctx, chat, id: kind.id, ...(onChat ? { onChat } : {}) }} saved={po.state.pos} view={view} onDrop={po.move} onClose={po.close} /> : null;
}

export function PopoutHost({ ctx, chat, kinds, onChat }: { ctx: AppContext; chat: Chat; kinds: readonly PopoutKind[]; onChat?: (chat: Chat) => void }): JSX.Element {
  const layer = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Box>({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const measure = (): void => {
      const box = layer.current?.getBoundingClientRect();
      setView(box && box.width > 0 && box.height > 0 ? { width: box.width, height: box.height } : { width: window.innerWidth, height: window.innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return <div className="po-layer" ref={layer} data-part="scene.popout">{kinds.map((k) => <Floating key={`${chat.id}:${k.id}`} kind={k} ctx={ctx} chat={chat} view={view} {...(onChat ? { onChat } : {})} />)}</div>;
}

export function PopoutSlot({ kind, ctx, chat, onChat }: { kind: PopoutKind; ctx: AppContext; chat: Chat; onChat?: (chat: Chat) => void }): JSX.Element {
  const po = usePopout(ctx, kind.id);
  return po.state.open ? <PopoutPlaceholder kind={kind} onBack={po.close} /> : kind.render({ ctx, chat, id: kind.id, popOut: po.open, ...(onChat ? { onChat } : {}) });
}
