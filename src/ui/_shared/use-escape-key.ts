/**
 * One Escape arbiter for document-level consumers and modal owners. Dispatch happens at document
 * bubble, after editor-local handlers have had the chance to consume the press (B16/UI2).
 */
import { useEffect, useRef, type RefObject } from "react";
import { isTypingTarget } from "./typing-target";

/** The keyboard-event fields the close rule reads. */
export interface CloseKeyEvent {
  key: string;
  defaultPrevented?: boolean;
  isComposing?: boolean;
}

/** Escape closes unless something inside already spent the press or an IME is composing. */
export function isEscapeClose(e: CloseKeyEvent): boolean {
  return e.key === "Escape" && !e.defaultPrevented && e.isComposing !== true;
}

interface EscapeOwner {
  order: number;
  element: () => HTMLElement | null;
  onEscape: () => void;
  modal: boolean;
  /** A non-modal owner may decline a press (it is then left unspent for the next owner). */
  accepts?: (event: KeyboardEvent) => boolean;
}

interface EscapeDocument {
  owners: Set<EscapeOwner>;
  listener: (event: KeyboardEvent) => void;
  nextOrder: number;
}

/**
 * The arbiter lives on the document itself, not in this module: the app builds the shell and each room as separate
 * bundles, each with its own copy of this file, and two arbiters would each claim the press (the first one
 * prevents it, the second then sees it as spent), so the newest consumer never heard it.
 */
const SLOT = Symbol.for("bunraku.escape-arbiter");
const slot = (doc: Document): { [SLOT]?: EscapeDocument } => doc as unknown as { [SLOT]?: EscapeDocument };

function above(left: EscapeOwner, right: EscapeOwner): boolean {
  const a = left.element();
  const b = right.element();
  if (!a?.isConnected || !b?.isConnected) return left.order > right.order;
  const view = a.ownerDocument.defaultView;
  const az = Number.parseInt(view?.getComputedStyle(a.parentElement ?? a).zIndex ?? "", 10) || 0;
  const bz = Number.parseInt(view?.getComputedStyle(b.parentElement ?? b).zIndex ?? "", 10) || 0;
  if (az !== bz) return az > bz;
  const relation = a.compareDocumentPosition(b);
  if (relation & 1) return left.order > right.order;
  if (relation & 2) return true;
  if (relation & 4) return false;
  return left.order > right.order;
}

function topmostModal(state: EscapeDocument): EscapeOwner | undefined {
  const modals = [...state.owners].filter((owner) => owner.modal);
  return modals.reduce<EscapeOwner | undefined>((top, owner) => !top || above(owner, top) ? owner : top, undefined);
}

/** True only for the visually top modal, including the z-order of its placement wrapper. */
export function isTopDialog(element: HTMLElement): boolean {
  const doc = element.ownerDocument;
  if (doc.querySelector("dialog[open]")) return false;
  const dialogs = [...doc.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')];
  return dialogs.reduce<HTMLElement | undefined>((top, candidate) => {
    if (!top) return candidate;
    const left: EscapeOwner = { order: 0, element: () => candidate, onEscape: () => undefined, modal: true };
    const right: EscapeOwner = { order: 0, element: () => top, onEscape: () => undefined, modal: true };
    return above(left, right) ? candidate : top;
  }, undefined) === element;
}

function attach(doc: Document): EscapeDocument {
  const existing = slot(doc)[SLOT];
  if (existing) return existing;
  const state: EscapeDocument = { owners: new Set(), nextOrder: 0, listener: () => undefined };
  state.listener = (event): void => {
    if (!isEscapeClose(event)) return;
    if (doc.querySelector("dialog[open]")) return;
    const modal = topmostModal(state);
    const generic = [...state.owners].filter((owner) => !owner.modal && (owner.accepts?.(event) ?? true))
      .reduce<EscapeOwner | undefined>((top, owner) => !top || owner.order > top.order ? owner : top, undefined);
    // A modal owns Escape over global route hooks. Interactive popovers consume their own key on
    // the target before this document-bubble boundary, leaving the modal for the next press.
    const owner = modal ?? generic;
    if (!owner) return;
    event.preventDefault();
    event.stopPropagation();
    owner.onEscape();
  };
  doc.addEventListener("keydown", state.listener);
  slot(doc)[SLOT] = state;
  return state;
}

function register(doc: Document, owner: Omit<EscapeOwner, "order">): () => void {
  const state = attach(doc);
  const entry = { ...owner, order: ++state.nextOrder };
  state.owners.add(entry);
  return () => {
    state.owners.delete(entry);
    if (state.owners.size === 0) {
      doc.removeEventListener("keydown", state.listener);
      delete slot(doc)[SLOT];
    }
  };
}

/**
 * A non-modal Escape consumer. At most one active consumer receives a qualifying press.
 * `outsideFields` declines a press that comes from a text box or dropdown: half-typed text and an
 * autocomplete own that press, and a declined press stays unspent for the next owner.
 */
export function useEscapeKey(onEscape: () => void, enabled = true, options?: { outsideFields?: boolean }): void {
  const callback = useRef(onEscape);
  callback.current = onEscape;
  const outsideFields = options?.outsideFields === true;
  useEffect(() => {
    if (!enabled) return;
    return register(document, {
      element: () => null,
      modal: false,
      onEscape: () => callback.current(),
      ...(outsideFields ? { accepts: (event: KeyboardEvent) => !isTypingTarget(event.target) } : {}),
    });
  }, [enabled, outsideFields]);
}

/** Registers a modal shell as the Escape owner for keys targeted inside it. */
export function useDialogEscape(
  element: RefObject<HTMLElement | null>,
  onEscape: () => void,
  enabled = true,
): void {
  const callback = useRef(onEscape);
  callback.current = onEscape;
  useEffect(() => {
    if (!enabled) return;
    const doc = element.current?.ownerDocument;
    if (!doc) return;
    return register(doc, { element: () => element.current, modal: true, onEscape: () => callback.current() });
  }, [element, enabled]);
}
