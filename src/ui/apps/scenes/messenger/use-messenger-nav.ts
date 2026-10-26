/**
 * Which program the Messenger shows (RoleCall DiscordChrome.tsx:119-157,186-191, here with one open program at a time): opening one swaps whatever was open, closing returns to the chat,
 * the programs visited stay in `visited` so the shell keeps them mounted and their drafts survive, and a request from elsewhere on the page (the composer's AI hint, the Booth's rows, the
 * Story Director's settings link) opens the wing's first program. A program that leaves the list (its Prop switched off) drops out of every one of these. How a program is drawn
 * (Side, Wide, Popout or Layer) is shell/surfaces.ts; this hook does not know.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Program } from "./programs";

/** A numbered ask from the page to open a wing (null: back to the chat); each number is honoured once. */
export interface MessengerRequest { n: number; wing: string | null }

export function useMessengerNav(programs: readonly Program[], request: MessengerRequest | null | undefined) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const handled = useRef(0);
  const has = useCallback((id: string | null): boolean => id !== null && programs.some((p) => p.id === id), [programs]);
  const selected = programs.find((p) => p.id === openId);
  const open = useCallback((id: string): void => {
    if (!has(id)) return;
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    setOpenId(id);
    setNavOpen(false);
  }, [has]);
  const close = useCallback((): void => setOpenId(null), []);
  useEffect(() => {
    setVisited((v) => v.filter(has));
    setOpenId((id) => (has(id) ? id : null));
  }, [has]);
  useEffect(() => {
    if (!request || request.n <= handled.current) return;
    handled.current = request.n;
    const program = request.wing === null ? undefined : programs.find((p) => p.wing === request.wing);
    if (program) open(program.id);
    else if (request.wing === null) close();
  }, [request, programs, open, close]);
  return { openId, selected, visited, navOpen, setNavOpen, open, close };
}
