/**
 * "+ Marker" in the prompt list's toolbar (wireframe design/wireframes/premiere/prompt-placement-nodes.html, Legacy,
 * callout 4): every marker slot, SillyTavern's and Bunraku's feature markers, with the placed ones greyed, since a slot
 * is placed once (session.ts addMarker refuses a second). The new marker lands at the end of the list.
 */
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Button, MenuItem } from "../../../components/button";
import { FEATURE_MARKER_SLOTS, MARKER_LABELS } from "../../../../core/preset";
import { isEscapeClose } from "../../../_shared/use-escape-key";
import { markerSlotName } from "./session";
import s from "./toolbar.module.css";

const SLOTS: readonly string[] = [...Object.keys(MARKER_LABELS), ...FEATURE_MARKER_SLOTS];

export function MarkerMenu({ placed, onAdd }: { placed: ReadonlySet<string>; onAdd(slot: string): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent): void => {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <span className={s.menuWrap} ref={rootRef} onKeyDown={(ev) => { if (isEscapeClose(ev)) setOpen(false); }}>
      <Button size="sm" icon="lucide:plus" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>Marker</Button>
      {open && (
        <span className={s.menu} role="menu" aria-label="Add a marker">
          <small className={s.menuNote}>Places where a feature splices in</small>
          {SLOTS.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (slot) => {
            const taken = placed.has(slot);
            return (
              <MenuItem key={slot} disabled={taken} hint={taken ? "placed" : undefined} onClick={() => { setOpen(false); onAdd(slot); }}>
                {markerSlotName(slot)}
              </MenuItem>
            );
          })}
        </span>
      )}
    </span>
  );
}
