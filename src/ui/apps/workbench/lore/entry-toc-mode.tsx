/**
 * Fire-mode dropdown for TOC rows: Keywords / Always on / By meaning (icons + color).
 */
import { Button, MenuItem } from "../../../components/button";
import { useEffect, useRef, useState, type JSX } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import { type EntryFireMode } from "./entry-fire-mode";

const MODE_OPTS: readonly {
  mode: EntryFireMode;
  label: string;
  icon: IconName;
}[] = [
  { mode: "keyed", label: "Keywords", icon: "lucide:key-round" },
  { mode: "always", label: "Always on", icon: "lucide:pin" },
  { mode: "meaning", label: "By meaning", icon: "lucide:sparkles" },
];

export function ModeSelect({
  mode,
  vectorOk,
  styles,
  onChange,
}: {
  mode: EntryFireMode;
  vectorOk: boolean;
  styles: Readonly<Record<string, string>>;
  onChange: (mode: EntryFireMode) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const current = MODE_OPTS.find((o) => o.mode === mode) ?? MODE_OPTS[0]!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent): void => {
      if (wrap.current && !wrap.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={styles.modeSelect} data-mode={mode} ref={wrap}>
      <Button
        size="sm"
        variant="quiet"
        menu
        icon={current.icon}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Trigger method: ${current.label}`}
        title={current.label}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {current.label}
      </Button>
      {open && (
        <ul className={styles.modeMenu} role="listbox" aria-label="Trigger method">
          {MODE_OPTS.map(({ mode: m, label, icon }) => {
            const gated = m === "meaning" && !vectorOk;
            return (
              <li key={m} data-mode={m}>
                <MenuItem
                  role="option"
                  aria-selected={m === mode}
                  disabled={gated}
                  icon={<span className={styles.modeTone}><Ic name={icon} size={14} /></span>}
                  hint={m === mode ? <Ic name="lucide:check" size={12} /> : undefined}
                  title={
                    gated
                      ? "This host cannot carry by-meaning (vectorized) entries."
                      : label
                  }
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (gated) return;
                    onChange(m);
                    setOpen(false);
                  }}
                >
                  {label}
                </MenuItem>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
