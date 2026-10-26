/**
 * The write behaviour the chat-backed settings rows share. A scene value is saved through the existing `ctx.api.setScene*` writer, which answers after the round trip, so a row shows
 * what was just asked until the answer lands (a switch that waits for the server looks dead), and a field that is typed or dragged saves once it rests and never when it equals what is
 * saved. The draws are the settings row primitives (frames/settings-rows.tsx); nothing here stores anything.
 */
import { useState, type JSX } from "react";
import { useDebouncedSave } from "../../../../../_shared/use-debounced-value";
import { NumberRow, SliderRow, TextAreaRow, ToggleRow, type RowCopy } from "../../frames/settings-rows";

/** How long a typed or dragged value rests before it is saved. */
export const SAVE_MS = 400;

/** A value being edited: the draft while one is waiting, else what is saved. `write` is called once the draft rests and decides for itself whether it changes anything. */
export function useDraft<T>(saved: T, write: (value: T) => void | Promise<void>): [T, (value: T) => void] {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
  const sender = useDebouncedSave<T>(async (value) => {
    await write(value);
    setDraft((cur) => (cur !== null && cur.value === value ? null : cur));
  }, SAVE_MS, () => setDraft(null));
  return [draft ? draft.value : saved, (value) => { setDraft({ value }); sender.push(value); }];
}

/** A switch that shows the asked state while `write` runs. `write` reports its own failure (it must not reject). */
export function SavedToggle({ saved, write, ...copy }: RowCopy & { saved: boolean; write(on: boolean): Promise<void> }): JSX.Element {
  const [asked, setAsked] = useState<boolean | null>(null);
  return <ToggleRow {...copy} on={asked ?? saved} onChange={(on) => { setAsked(on); void write(on).finally(() => setAsked(null)); }} />;
}

export function SavedNumber({ saved, min, max, step, write, ...copy }: RowCopy & { saved: number; min: number; max: number; step?: number; write(value: number): void | Promise<void> }): JSX.Element {
  const [value, set] = useDraft(saved, (n) => { const c = Math.min(max, Math.max(min, n)); if (c !== saved) return write(c); });
  return <NumberRow {...copy} value={value} min={min} max={max} {...(step ? { step } : {})} onChange={set} />;
}

export function SavedSlider({ saved, write, ...rest }: RowCopy & { saved: number; min: number; max: number; step?: number; unit?: string; write(value: number): void | Promise<void> }): JSX.Element {
  const [value, set] = useDraft(saved, (n) => { if (n !== saved) return write(n); });
  return <SliderRow {...rest} value={value} onChange={set} />;
}

export function SavedText({ saved, write, rows, ...copy }: RowCopy & { saved: string; rows?: number; write(value: string): void | Promise<void> }): JSX.Element {
  const [value, set] = useDraft(saved, (text) => { if (text !== saved) return write(text); });
  return <TextAreaRow {...copy} value={value} {...(rows ? { rows } : {})} onChange={set} />;
}
