/**
 * The Script Sheet editor, ported from RoleCall (components/scene/wings/panels/ScriptSheetEditor.tsx): a name, one
 * instruction, the samplers handed in, and one save. RoleCall opens the same editor from Prompting and from the
 * Library, and so does Bunraku: the Prompting wing and the Workbench both mount this. A new sheet is created and then
 * chosen; when choosing fails the saved sheet is kept and the button offers to use it. Unsaved changes ask before going
 * back. The host may own the save keys and the dirty mark (the Workbench's guards); otherwise Ctrl+S saves here.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type MutableRefObject, type ReactNode } from "react";
import { SCRIPT_SHEET_LIMIT, scriptSheetProblem } from "../../core/preset/script-sheet";
import { Button } from "../components/button";
import { Input, Textarea } from "../components/rc-controls";
import { RoomHeader } from "../components/room-header";
import { toErrorMessage } from "./error-message";
import s from "./script-sheet-editor.module.css";

export interface SheetDraft { name: string; content: string }
export interface SheetHandle { save(): Promise<boolean> }

/** Why this draft cannot be saved; a blank draft says nothing, its Save simply waits. */
export const sheetDraftProblem = (content: string): string | null => (content.trim() ? scriptSheetProblem(content) : null);

export function ScriptSheetEditor({ initial, samplers, actions, save, choose, onBack, extraDirty = false, handle, onState }: {
  /** The saved sheet being edited; absent while writing a new one. */
  initial?: SheetDraft;
  samplers?: ReactNode;
  /** The host's own buttons, beside Back in the header. */
  actions?: ReactNode;
  /** Writes the draft; rejects with words fit to show. */
  save(draft: SheetDraft): Promise<void>;
  /** Chooses the saved sheet for the scene, after a new one is saved. */
  choose?(): Promise<void>;
  onBack?(): void;
  /** Host edits that ride the same save (the Workbench's settings and samplers). */
  extraDirty?: boolean;
  /** Given, the host owns the save keys and calls `save` through it. */
  handle?: MutableRefObject<SheetHandle | null>;
  /** Whether there are unsaved changes, and whether they can be saved now. */
  onState?(state: { dirty: boolean; ready: boolean }): void;
}): JSX.Element {
  const [name, setName] = useState(initial?.name ?? "My Script Sheet");
  const [content, setContent] = useState(initial?.content ?? "");
  const [committed, setCommitted] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const busy = useRef(false);
  const dirty = name !== committed?.name || content !== committed?.content || extraDirty;
  const problem = sheetDraftProblem(content);
  const ready = !saving && !!name.trim() && !!content.trim() && !problem && (dirty || activationPending);

  const run = useCallback(async (): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      if (!activationPending) {
        await save({ name, content });
        setCommitted({ name, content });
      }
      if (choose) {
        setActivationPending(true);
        await choose();
      }
      setActivationPending(false);
      return true;
    } catch (cause) {
      setError(toErrorMessage(cause, "Could not save. Your draft has been kept."));
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [activationPending, save, choose, name, content]);

  useEffect(() => { onState?.({ dirty, ready }); }, [dirty, ready, onState]);
  if (handle) handle.current = { save: () => (ready ? run() : Promise.resolve(false)) };
  useEffect(() => {
    if (handle) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (ready) void run();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [handle, ready, run]);

  const edited = (set: (v: string) => void) => (v: string) => { set(v); setActivationPending(false); };
  return (
    <div className={s.root} data-part="script-sheet.editor">
      <RoomHeader kicker="Prompting" title="Script Sheet" lede="One prompt for the writing. Character and scene context are included automatically."
        actions={<>{actions}{onBack && <Button variant="quiet" size="sm" icon="lucide:chevron-left" disabled={saving} onClick={() => (dirty ? setConfirmDiscard(true) : onBack())}>Back to Script Sheets &amp; Presets</Button>}</>} />
      {confirmDiscard && onBack && (
        <div role="alertdialog" aria-label="Discard unsaved Script Sheet changes?" className={s.discard}>
          <span>Discard unsaved changes?</span>
          <Button size="sm" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
          <Button size="sm" variant="danger" onClick={onBack}>Discard draft</Button>
        </div>
      )}
      {samplers}
      <div className={s.nameRow}>
        <label htmlFor="script-sheet-name" className="sr-only">Script Sheet name</label>
        <Input id="script-sheet-name" className={s.name} value={name} maxLength={100} disabled={saving} onChange={(e) => edited(setName)(e.target.value)} />
        <span className={s.role}>System</span>
      </div>
      <label htmlFor="script-sheet-content" className="sr-only">Writing instructions</label>
      <Textarea id="script-sheet-content" className={s.text} value={content} disabled={saving} maxLength={SCRIPT_SHEET_LIMIT} spellCheck={false}
        placeholder="Write or paste your instructions here..." aria-invalid={problem ? true : undefined} onChange={(e) => edited(setContent)(e.target.value)} />
      {(problem ?? error) && <p role="alert" className={s.problem}>{problem ?? error}</p>}
      <div className={s.foot}>
        <span role="status">{saving ? "Saving..." : dirty ? "Unsaved draft" : "Saved to your library"}</span>
        <Button variant="primary" size="sm" disabled={!ready} onClick={() => void run()}>
          {activationPending ? "Use saved Script Sheet" : committed ? "Save Script Sheet" : "Save & use Script Sheet"}
        </Button>
      </div>
    </div>
  );
}
