/** Export library: the one call and the words for it, shared by Settings, Backups and the Messenger Data and backups page. */
import { useState } from "react";
import { apiFetchJson } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";
import { plural } from "../../../../core/text";

export interface LibraryExported {
  folder: string;
  pieces: number;
  documents: number;
  damaged: number;
}

export const exportLibraryCall = (): Promise<LibraryExported> =>
  apiFetchJson<LibraryExported>("/api/library/export", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });

/** Where the folder went, and the two facts the person must know: it is not encrypted, and what was left out. */
export const exportedWords = (r: LibraryExported): string =>
  `Exported ${plural(r.pieces, "piece", "pieces")} to ${r.folder}.${r.damaged > 0 ? ` ${plural(r.damaged, "damaged piece was", "damaged pieces were")} left out.` : ""} The folder is not encrypted.`;

/** Busy flag and the note to show: "exporting...", the result, or the refusal. */
export function useLibraryExport(): { busy: boolean; note: string | undefined; run: () => void } {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | undefined>(undefined);
  const run = (): void => {
    if (busy) return;
    setBusy(true);
    setNote("exporting...");
    exportLibraryCall().then(
      (r) => { setNote(exportedWords(r)); setBusy(false); },
      (e: unknown) => { setNote(toErrorMessage(e, "the library could not be exported")); setBusy(false); },
    );
  };
  return { busy, note, run };
}
