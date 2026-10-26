/**
 * <ThemeSlot id>: the host-drawn home for a theme's static content. Items are data (an image from the package or a
 * line of text), drawn as React elements, so text is always text and an image always comes from the digest asset
 * route. It renders nothing, and adds no node, when the active theme put nothing in the slot.
 */
import { useSyncExternalStore, type JSX } from "react";
import { readSlotItems, SLOT_ATTRIBUTE, type DrawnItem, type SlotId } from "./theme-slot-core";

const listeners = new Set<() => void>();
let watcher: MutationObserver | null = null;
let cachedRaw: string | null | undefined;
let cached: ReturnType<typeof readSlotItems> = new Map();

function subscribe(notify: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  listeners.add(notify);
  watcher ??= new MutationObserver(() => { for (const listener of listeners) listener(); });
  watcher.observe(document.documentElement, { attributes: true, attributeFilter: [SLOT_ATTRIBUTE] });
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) { watcher?.disconnect(); watcher = null; }
  };
}

/** Same payload, same map: React needs a stable snapshot between renders. */
function snapshot(): ReturnType<typeof readSlotItems> {
  const raw = typeof document === "undefined" ? null : document.documentElement.getAttribute(SLOT_ATTRIBUTE);
  if (raw !== cachedRaw) { cachedRaw = raw; cached = readSlotItems(raw); }
  return cached;
}

const NONE: ReturnType<typeof readSlotItems> = new Map();

function Item({ item }: { item: DrawnItem }): JSX.Element {
  return item.kind === "image"
    ? <img data-part="slot.image" src={item.src} alt={item.alt} decoding="async" />
    : <span data-part="slot.text" className={item.className}>{item.text}</span>;
}

export function ThemeSlot({ id }: { id: SlotId }): JSX.Element | null {
  const items = useSyncExternalStore(subscribe, snapshot, () => NONE).get(id);
  if (!items) return null;
  return (
    <div data-part={`slot.${id}`}>
      {items.map(/* bounded-ok: single message / fixed menu or glyph parts */ (item, at) => <Item key={at} item={item} />)}
    </div>
  );
}
