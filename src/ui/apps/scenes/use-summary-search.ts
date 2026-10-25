/**
 * The Scenes list's search of chat summaries (rc-parity 08, follow-up 2): once the typing pauses, the studio is asked which scenes' summaries hold the words, and those scenes join the ones
 * whose title or character matched. A query with no word of two characters never asks. A failed ask keeps the title matches and says the summaries could not be searched; a stale answer
 * is dropped.
 */
import { useEffect, useState } from "react";
import { searchTerms } from "../../../core/scene-search";

/** How long typing must pause before the studio is asked. */
export const SUMMARY_SEARCH_MS = 250;

export interface SummarySearch { ids: ReadonlySet<string>; failed: boolean }
const NONE: SummarySearch = { ids: new Set(), failed: false };

export function useSummarySearch(search: (query: string) => Promise<{ ids: string[] }>, query: string): SummarySearch {
  const [found, setFound] = useState<SummarySearch & { for: string }>({ ...NONE, for: "" });
  const q = query.trim();
  const asks = searchTerms(q).length > 0;
  useEffect(() => {
    if (!asks) return;
    let live = true;
    const timer = setTimeout(() => {
      search(q).then(
        (r) => { if (live) setFound({ ids: new Set(r.ids), failed: false, for: q }); },
        () => { if (live) setFound({ ids: new Set(), failed: true, for: q }); },
      );
    }, SUMMARY_SEARCH_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [search, q, asks]);
  // An answer belongs to the query it was asked for; a changed query shows none until its own arrives.
  return asks && found.for === q ? found : NONE;
}
