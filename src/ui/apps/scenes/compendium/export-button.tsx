/**
 * The Dashboard's EXPORT (RoleCall `BentoDashboard.tsx:515-552`): the open book as RoleCall's compendium file, named
 * `<name>__<timestamp>.compendium.json`. The server streams it entry by entry; here it drains into a Blob and the Blob is saved
 * (the download sink's two doors), so no whole-file string or array is ever built.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { drainToBlob, saveBlob } from "../../../_shared/download-sink";
import { toErrorMessage } from "../../../_shared/error-message";
import { Ic } from "../../../_shared/ic";

/** RoleCall's file name rule (`BentoDashboard.tsx:539-543`). */
export const exportName = (bookName: string, now: Date): string =>
  `${bookName.replace(/[^a-z0-9-_ ]/gi, "_").trim().slice(0, 80) || "compendium"}__${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.compendium.json`;

export function ExportButton({ ctx, bookId, bookName }: { ctx: AppContext; bookId: string; bookName: string }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const blob = await drainToBlob(await ctx.api.exportCompendium(bookId), "application/json");
      await saveBlob(blob, exportName(bookName, new Date()));
    } catch (e) {
      ctx.setStatus(`Export failed: ${toErrorMessage(e, "the book could not be exported")}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="cp-exp-btn" data-part="compendium.export" disabled={busy} onClick={() => void run()}
      title="Download the full compendium as JSON: keeps every entry type, structured field, category and entry setting">
      <Ic name="lucide:download" size={12} />Export
    </button>
  );
}
