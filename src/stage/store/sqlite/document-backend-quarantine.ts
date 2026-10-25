/**
 * Row quarantine for the content store's list reads (ChatStore rule 25,
 * applied to `document-backend.ts`: `list`, `summaries`, and `documentVersions` each open a sealed
 * identity cell per row before the caller sees anything, so one row with a damaged `id_cell` used to
 * throw out of the whole page, hiding every healthy row beside it (chat-store-quarantine.ts's own
 * finding, generalized - a document's id is itself a sealed cell, unlike a chat's plain one, so the
 * quarantined entry here names `kind` plus the row's own opaque stored key, never a real id). Split
 * from document-backend.ts for the file-size cap.
 */
import type { QuarantinedRow } from "../../contracts/content-store";
import { breather } from "../breather";
import { isQuarantinableDecodeError } from "./quarantine";

/** Rows per page when listing: small enough that one page reads well inside the speed budget.
 *  Exported so document-backend.ts's own SELECT ... LIMIT clauses cannot drift from the page size
 *  this file tests "was that the last page" against (fold B32: two copies of the same literal, one
 *  LIMIT and one has-more test, with nothing enforcing they agree). */
export const PAGE = 250;

/**
 * Pages through a table in primary-key order, opening rows in slices between breaths, exactly like
 * `document-backend.ts`'s own (unguarded) `paged` - except a row whose `open` throws `DamagedDataError`
 * or `SyntaxError` is set aside into `quarantined` instead of ending the whole page. Anything else
 * `open` throws (a real bug, `LockedError`, ...) still throws out of this call: only a decode failure
 * this store already has a name for is caught.
 */
export async function pagedQuarantined<S extends { kind: string; id: string }, R, A>(
  start: A,
  select: (after: A) => S[],
  keyOfRow: (row: S) => A,
  open: (row: S) => R,
): Promise<{ rows: R[]; quarantined: QuarantinedRow[] }> {
  const rows: R[] = [];
  const quarantined: QuarantinedRow[] = [];
  const breathe = breather();
  let after = start;
  for (;;) {
    const page = select(after);
    for (const r of page) {
      try {
        rows.push(open(r));
      } catch (error) {
        if (isQuarantinableDecodeError(error)) quarantined.push({ kind: r.kind, key: r.id });
        else throw error;
      }
      await breathe();
    }
    if (page.length < PAGE) break;
    after = keyOfRow(page[page.length - 1]!);
    await breathe();
  }
  return { rows, quarantined };
}

/** `versions()`'s own shape: one piece's history is already addressed by its own (kind, id), so a
 * quarantined entry needs only the version number - a plain column, never sealed - to say which one. */
export function splitVersionQuarantine<S extends { version: number }, R>(open: (row: S) => R, rows: readonly S[]): { rows: R[]; quarantined: number[] } {
  const healthy: R[] = [];
  const quarantined: number[] = [];
  for (const r of rows) {
    try {
      healthy.push(open(r));
    } catch (error) {
      if (isQuarantinableDecodeError(error)) quarantined.push(r.version);
      else throw error;
    }
  }
  return { rows: healthy, quarantined };
}
