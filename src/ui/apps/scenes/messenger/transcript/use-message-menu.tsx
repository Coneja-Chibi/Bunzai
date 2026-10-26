/**
 * Right click and long press on a Messenger message (backlog slice 5): `bind` goes on the message's root element, `node` is the open menu. The items come from `messageMenu`, which calls the
 * bubble's own action props, so Edit, Copy, Delete and the rest are the hover bar's dispatchers, never copies. E and C pick Edit and Copy while the menu is open. Under 640px the menu is a bottom
 * sheet (messenger-chat-style.ts). A reply being written, a message being edited and a click in a text field keep their own behavior.
 */
import { useEffect, useMemo, type JSX, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { isTypingTarget } from "../../../../_shared/typing-target";
import { uniqueRange, type TextRange } from "../../../../../core/draft-prompts";
import type { BubbleProps } from "../../scene-bubble";
import { ContextMenu, useContextMenuTrigger } from "../frames/context-menu";
import { messageMenu } from "./message-menu";

const highlighted = (text: string): TextRange | null => {
  const picked = typeof window === "undefined" ? "" : window.getSelection()?.toString() ?? "";
  return picked.trim() ? uniqueRange(text, picked) : null;
};

export interface MessageMenu {
  bind: { onContextMenu?: (e: MouseEvent) => void; onPointerDown?: (e: PointerEvent) => void; onPointerMove?: (e: PointerEvent) => void; onPointerUp?: () => void; onPointerCancel?: () => void };
  node: JSX.Element | null;
}

export function useMessageMenu(p: BubbleProps, copy: () => void): MessageMenu {
  const trigger = useContextMenuTrigger();
  const on = p.contextMenu === true && !p.live && p.editing === undefined;
  const open = on && trigger.at !== null;
  const reads = open && Boolean(p.onUndoEdit);
  // Undo last edit and Edit history need the version texts More reads when it opens; ask for them the same way, then let the More menu go again.
  useEffect(() => {
    if (!reads) return;
    p.onMenu?.(p.id, "more");
    p.onMenu?.(p.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [reads]);
  const items = useMemo(() => (open ? messageMenu(p, { copy, selection: () => highlighted(p.copyText ?? p.text) }) : []), [open, p, copy]);
  if (!on) return { bind: {}, node: null };
  const { bind } = trigger;
  const shortcut = (e: KeyboardEvent): void => {
    const id = e.ctrlKey || e.metaKey || e.altKey ? "" : e.key.toLowerCase() === "e" ? "edit" : e.key.toLowerCase() === "c" ? "copy" : "";
    const hit = id ? items.find((i) => i.id === id) : undefined;
    if (!hit || !("onSelect" in hit)) return;
    e.preventDefault();
    hit.onSelect?.();
    trigger.close();
  };
  return {
    bind: { ...bind, onContextMenu: (e) => { if (!isTypingTarget(e.target)) bind.onContextMenu(e); } },
    node: trigger.at && items.length ? <span onKeyDown={shortcut}><ContextMenu items={items} at={trigger.at} label="Message menu" onClose={trigger.close} /></span> : null,
  };
}
