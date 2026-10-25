/** Character composite history application and keyboard binding. */
import { useCallback } from "react";
import { applyEditorHistoryChange, EditorMutationLedger, useEditorHistoryKeys, type EditorTouch } from "../../_shared/editor-state";

export type CharacterDraft = { body: Record<string, unknown>; original: Record<string, unknown> };
export const characterDraftTouch: EditorTouch<CharacterDraft> = {
  key: "document", read: (value) => value, write: (_value, next) => next as CharacterDraft,
};

export function useCharacterHistory(
  ledger: EditorMutationLedger<CharacterDraft>, draftRef: { current: CharacterDraft }, pieceId: string,
  markEdited: (next: CharacterDraft, touch?: EditorTouch<CharacterDraft>, reconcile?: boolean) => void,
  setBody: (next: Record<string, unknown>) => void, setOriginal: (next: Record<string, unknown>) => void, setStatus: (message: string) => void,
  onNamedHistoryChange?: () => void,
): void {
  const undo = useCallback(() => {
    const change = ledger.history.undo();
    if (!change) return;
    if (change.touch?.key === "original:risu:namedAssets") onNamedHistoryChange?.();
    const draft = applyEditorHistoryChange(draftRef.current, change, "character", pieceId);
    draftRef.current = draft;
    markEdited(draft, change.touch ?? characterDraftTouch, true);
    setBody(draft.body);
    setOriginal(draft.original);
  }, [ledger, draftRef, pieceId, markEdited, setBody, setOriginal, onNamedHistoryChange]);
  const redo = useCallback(() => {
    const change = ledger.history.redo();
    if (!change) return;
    if (change.touch?.key === "original:risu:namedAssets") onNamedHistoryChange?.();
    const draft = applyEditorHistoryChange(draftRef.current, change, "character", pieceId);
    draftRef.current = draft;
    markEdited(draft, change.touch ?? characterDraftTouch, true);
    setBody(draft.body);
    setOriginal(draft.original);
  }, [ledger, draftRef, pieceId, markEdited, setBody, setOriginal, onNamedHistoryChange]);
  useEditorHistoryKeys(ledger.history.canUndo, ledger.history.canRedo, undo, redo, setStatus, "character");
}
