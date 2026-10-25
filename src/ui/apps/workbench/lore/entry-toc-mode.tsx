/**
 * Fire-mode dropdown for TOC rows: Keywords / Always on / By meaning (icons + color).
 */
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

function modeTone(mode: EntryFireMode, styles: Readonly<Record<string, string>>): string {
  if (mode === "always") return styles.modeAlways ?? "";
  if (mode === "meaning") return styles.modeMeaning ?? "";
  return styles.modeKey ?? "";
}

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
    <div className={styles.modeSelect} ref={wrap}>
      <button
        type="button"
        className={`${styles.modeTrigger} ${modeTone(mode, styles)}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Trigger method: ${current.label}`}
        title={current.label}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Ic name={current.icon} size={12} />
        <span>{current.label}</span>
      </button>
      {open && (
        <ul className={styles.modeMenu} role="listbox" aria-label="Trigger method">
          {MODE_OPTS.map(({ mode: m, label, icon }) => {
            const gated = m === "meaning" && !vectorOk;
            return (
              <li key={m}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m === mode}
                  disabled={gated}
                  className={[
                    styles.modeOpt,
                    modeTone(m, styles),
                    m === mode ? styles.modeOptOn : "",
                    gated ? styles.modeOptGated : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
                  <Ic name={icon} size={12} />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
