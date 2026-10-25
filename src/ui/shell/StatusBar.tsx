/**
 * Contextual status beside the top chrome: real messages, Browser Studio's warning and approved theme slots.
 * Keeps the shared library count current; routine metrics live in the optional overlay.
 */
import { useEffect, useState, useSyncExternalStore, type JSX } from "react";
import { nextStudioCountRequest, useShellStore } from "./store";
import { isBrowserStudio } from "../_shared/asset-url";
import { useStudioChanges } from "../agent/use-studio-changes";
import type { PieceStore } from "../_shared/piece-store";
import { ThemeSlot } from "../_shared/theme-slot";
import { FLASH_MS, useAutoDismiss } from "../_shared/use-flash";

export function StatusBar({ pieces }: { pieces: PieceStore }): JSX.Element {
  const statusNote = useShellStore((s) => s.statusNote);
  const bootListFailed = useShellStore((s) => s.bootListFailed);
  const { seeded } = useStudioChanges(pieces);
  const list = useSyncExternalStore(pieces.subscribeList.bind(pieces), pieces.listSnapshot.bind(pieces), () => []);

  useEffect(() => {
    if (!seeded) return;
    const token = nextStudioCountRequest();
    useShellStore.getState().setStudioCount(list.length, token);
    useShellStore.getState().setBootListFailed(null);
  }, [list, seeded]);

  const browserStudio = isBrowserStudio();
  // A boot-list failure is sticky: it outranks any routine statusNote write (mountApp resetting it on
  // an app switch included) until either it clears above (a later list load succeeds) or a fresh boot
  // replaces it outright.
  const noteShown = bootListFailed ?? statusNote;
  // A toast variant (ui.toast) lifts a NEW note out of the footer for a few seconds; the note itself never goes away, it settles back into the footer line.
  const [liveNote, setLiveNote] = useState(false);
  useEffect(() => { setLiveNote(Boolean(noteShown)); }, [noteShown]);
  useAutoDismiss(noteShown, FLASH_MS.status, () => setLiveNote(false));

  return (
    <aside id="status" aria-label="Studio status" data-part="shell.status">
      {noteShown && <span className="seg trim note" role="status" data-toast={liveNote ? "live" : undefined}><span className="k">{noteShown}</span></span>}
      {browserStudio ? (
        <span className="seg trim" title="This browser studio keeps everything in this page only.">
          <span className="k">temporary studio</span>
          <span className="b">export before reload</span>
        </span>
      ) : null}
      <ThemeSlot id="shell.status.end" />
    </aside>
  );
}
