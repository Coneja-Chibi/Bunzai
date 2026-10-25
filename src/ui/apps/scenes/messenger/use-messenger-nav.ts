/**
 * Which program the Messenger shows and how (RoleCall DiscordChrome.tsx:119-157,186-191): a program opens as a TAB in place of the chat or as a MODAL dialog over it, the
 * programs visited stay mounted so their drafts survive, closing the dialog returns to the open tab, and a request from elsewhere on the page (the composer's AI hint, the Booth's
 * rows) opens the wing's first program. A program that leaves the list (its Prop switched off) drops out of every one of these.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Program } from "./programs";

/** A numbered ask from the page to open a wing (null: back to the chat); each number is honoured once. */
export interface MessengerRequest { n: number; wing: string | null }

export function useMessengerNav(programs: readonly Program[], request: MessengerRequest | null | undefined) {
  const [tabId, setTabId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const handled = useRef(0);
  const has = useCallback((id: string | null): boolean => id !== null && programs.some((p) => p.id === id), [programs]);
  const selectedId = modalId ?? tabId;
  const selected = programs.find((p) => p.id === selectedId);
  const open = useCallback((id: string, view: "tab" | "modal" = "tab"): void => {
    if (!has(id)) return;
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    if (view === "modal") setModalId(id);
    else { setTabId(id); setModalId(null); }
    setNavOpen(false);
  }, [has]);
  const showChat = useCallback((): void => { setTabId(null); setModalId(null); setNavOpen(false); }, []);
  useEffect(() => {
    setVisited((v) => v.filter(has));
    setTabId((id) => (has(id) ? id : null));
    setModalId((id) => (has(id) ? id : null));
  }, [has]);
  useEffect(() => {
    if (!request || request.n <= handled.current) return;
    handled.current = request.n;
    const program = request.wing === null ? undefined : programs.find((p) => p.wing === request.wing);
    if (program) open(program.id);
    else if (request.wing === null) showChat();
  }, [request, programs, open, showChat]);
  return {
    tabId, selectedId, selected, visited, navOpen, setNavOpen, open, showChat,
    closeSettings: useCallback((): void => setModalId(null), []),
    overlayOpen: modalId !== null && selected !== undefined,
    tabOpen: has(tabId),
  };
}
