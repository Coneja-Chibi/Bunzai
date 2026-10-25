/** React binding from LoreSession body updates to the shared editor mutation ledger. */
import { useCallback, useRef, useState } from "react";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import { EditorMutationLedger, type EditorTouch } from "../../../_shared/editor-state";

export function useLoreBodyDirty(initial: LorebookBody) {
  const [baseline, setBaseline] = useState(initial);
  const [dirty, setDirty] = useState(false);
  type FolderEdges = [string, string | null, boolean][];
  const ledgerRef = useRef<EditorMutationLedger<LorebookBody, FolderEdges> | null>(null);
  ledgerRef.current ??= new EditorMutationLedger(initial);
  const ledger = ledgerRef.current;
  const bodyRef = useRef(initial);
  const track = useCallback((body: LorebookBody, touch?: EditorTouch<LorebookBody>, revision = 0, reconcile = false): void => {
    bodyRef.current = body;
    ledger.track(body, touch, revision, reconcile);
    setDirty(ledger.dirty);
  }, [ledger]);
  const capturePatchState = useCallback((revision: number, body: LorebookBody) => {
    bodyRef.current = body;
    const release = ledger.beginSubmit(revision);
    const structural = ledger.structural;
    return { get structural() {
      if (ledger.structural) release.promote();
      return structural || ledger.structural;
    }, items: ledger.partItems(body),
      overwrite: () => { ledger.markOverwrite(revision); setDirty(ledger.dirty); },
      release: () => { release(bodyRef.current); setDirty(ledger.dirty); },
    };
  }, [ledger]);
  const accept = useCallback((fresh: LorebookBody, current: LorebookBody, revision: number): void => {
    bodyRef.current = current;
    setBaseline(fresh);
    ledger.accept(fresh, current, revision);
    setDirty(ledger.dirty);
  }, [ledger]);
  const reseed = useCallback((fresh: LorebookBody): void => {
    bodyRef.current = fresh;
    setBaseline(fresh);
    ledger.reseed(fresh);
    setDirty(false);
  }, [ledger]);
  return { baseline, dirty, track, capturePatchState, accept, reseed, history: ledger.history };
}
