/**
 * The background integrity check that runs alongside the summary rebuild: compares `count(*) documents` with `count(*)
 * document_summaries`, two `count(*)`s and no row's columns, so it costs nothing worth measuring.
 * A mismatch means some document has no `document_summaries` row at all - the one thing the D2
 * rebuild cannot repair, since `rewriteSummary` only UPDATEs an existing row. This reports that
 * rather than claiming the rebuild will catch up on its own. Run on the background lane
 * (`ui/library-root.ts`, alongside the rebuild scheduler), never from a list/inventory request.
 */
import type { DocumentBackend } from "../contracts/content-store";

const MAX_NAMED_GAPS = 20;

export async function checkSummaryCounts(backend: DocumentBackend): Promise<boolean> {
  const { documents, summaries } = await backend.counts();
  const ok = documents === summaries;
  if (!ok) {
    const gaps = await backend.summaryGaps();
    const shown = gaps.slice(0, MAX_NAMED_GAPS).map((g) => `${g.kind}:${g.id}`).join(", ");
    const more = gaps.length > MAX_NAMED_GAPS ? ` and ${gaps.length - MAX_NAMED_GAPS} more` : "";
    console.error(
      `library: ${documents} document(s) but ${summaries} summary row(s); no document_summaries row ` +
        `at all for: ${shown}${more} - the rebuild cannot create these on its own (rewriteSummary is ` +
        `UPDATE-only), they need a repair or a re-import`,
    );
  }
  return ok;
}
