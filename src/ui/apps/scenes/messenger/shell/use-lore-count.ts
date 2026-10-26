/**
 * How many lorebooks the open scene reads, for the header's topic line. The page holds the list once the Lorebooks wing has loaded it; until then (in the Messenger that is until Lorebooks has
 * been opened) one read of the scene's lore answers, and a failed read leaves the count out of the line instead of showing zero.
 */
import { useEffect, useState } from "react";
import type { AppContext } from "../../../../app-contract";
import type { SceneLoreBook } from "../../../../app-contract-scenes";

const active = (books: readonly SceneLoreBook[]): number => books.filter((b) => b.enabled && !b.missing).length;

/** `lore` is the scene's own lorebook choice, so a change to it reads again. */
export function useLoreCount(api: AppContext["api"], chatId: string | null, known: readonly SceneLoreBook[] | null, lore: unknown): number | null {
  const [read, setRead] = useState<number | null>(null);
  useEffect(() => {
    if (known !== null || chatId === null) return undefined;
    let live = true;
    Promise.resolve().then(() => api.getSceneLore(chatId)).then((l) => { if (live) setRead(active(l.books)); }, () => { if (live) setRead(null); });
    return () => { live = false; };
  }, [api, chatId, known, lore]);
  return known !== null ? active(known) : read;
}
