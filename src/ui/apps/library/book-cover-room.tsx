/** Own the Library cover dialog and preference updates, leaving shelf composition in the room. */
import { useState } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { BookCoverDialog } from "./book-cover";
import { readBookCover, saveBookCover } from "./book-cover-core";

export function useLibraryBookCovers(ctx: AppContext) {
  const [piece, setPiece] = useState<StudioEntitySummary | null>(null);
  return {
    of: (e: StudioEntitySummary) => readBookCover(ctx.prefs, e.id, !e.hasPortrait),
    design: setPiece,
    dialog: piece && <BookCoverDialog title={piece.name} initial={readBookCover(ctx.prefs, piece.id, !piece.hasPortrait)}
      onDismiss={() => setPiece(null)} onSave={(choice) => {
        saveBookCover(ctx.prefs, piece.id, choice);
        setPiece(null);
      }} />,
  };
}
