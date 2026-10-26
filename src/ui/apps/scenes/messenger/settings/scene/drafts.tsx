/**
 * The two typed rows the shared saved rows (saved.tsx) do not cover. A text that can be wrong (a JSON box, a list of names, a request field) keeps what is typed, says what is wrong under the label and saves only a text that
 * holds up, once it rests. A text that is kept as written (a summary written by hand) is saved by its own button, never halfway. The draws are the settings row primitives (frames/settings-rows.tsx).
 */
import { useEffect, useState, type JSX } from "react";
import { useDebouncedSave } from "../../../../../_shared/use-debounced-value";
import { ActionRow, TextAreaRow, type RowCopy } from "../../frames/settings-rows";
import { SAVE_MS } from "./saved";

/** A text area that saves what was typed once it rests, unless `check` names what is wrong with it. */
export function CheckedText({ saved, write, check, rows, delay = SAVE_MS, ...copy }: RowCopy & { saved: string; rows?: number; delay?: number; check?(text: string): string | null; write(text: string): void | Promise<void> }): JSX.Element {
  const [draft, setDraft] = useState(saved);
  const saver = useDebouncedSave<string>((t) => (t === saved ? undefined : write(t)), delay);
  // The stored text shows unless the person is mid-edit: a saved change lands, a failed one is put back.
  useEffect(() => { if (saver.pending() === undefined) setDraft(saved); }, [saved, saver]);
  const problem = check?.(draft) ?? null;
  const description = problem ?? copy.description;
  return (
    <TextAreaRow label={copy.label} {...(description ? { description } : {})} value={draft} {...(rows === undefined ? {} : { rows })}
      onChange={(t) => { setDraft(t); if (check?.(t)) saver.cancel(); else saver.push(t); }} />
  );
}

/** A text area saved by its own button: a summary written by hand is kept as written, so it is never saved halfway, and a blank one is never saved. */
export function SaveText({ saved, write, rows, action, ...copy }: RowCopy & { saved: string; rows?: number; action: string; write(text: string): void | Promise<void> }): JSX.Element {
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  return (
    <>
      <TextAreaRow {...copy} value={draft} {...(rows === undefined ? {} : { rows })} onChange={setDraft} />
      {draft !== saved && draft.trim() !== "" && <ActionRow label={`Save ${copy.label.toLowerCase()}`} action={action} variant="primary" onAction={() => void write(draft)} />}
    </>
  );
}
