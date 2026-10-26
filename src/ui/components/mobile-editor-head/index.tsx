/**
 * MobileEditorHead - the narrow-pane editor header: back / name / save / kebab, all thumb-sized
 * (design/vs-mobile-editors.html frame 1). Export, scale and mode switches live in the kebab.
 */
import { IconButton, MenuItem } from "../button";
import { useEffect, useRef, useState, type JSX } from "react";
import styles from "./styles.module.css";

export interface MobileMenuItem {
  label: string;
  onPick(): void;
  disabled?: boolean;
}

export interface MobileEditorHeadProps {
  name: string;
  /** Quiet second line under the name, e.g. "character · saved locally". */
  sub: string;
  dirty: boolean;
  saving: boolean;
  onBack(): void;
  onSave(): void;
  menu: readonly MobileMenuItem[];
}

/** Back / name / save / kebab at 2.2rem touch targets; the kebab holds the long tail. */
export function MobileEditorHead({ name, sub, dirty, saving, onBack, onSave, menu }: MobileEditorHeadProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={styles.head}>
      <IconButton size="sm" icon="lucide:arrow-left" label="Close" onClick={onBack} />
      <span className={styles.name}>
        <b>{name}</b>
        <i>{sub}</i>
      </span>
      <IconButton
        size="sm"
        variant="primary"
        icon="lucide:check"
        disabled={saving || !dirty}
        label={saving ? "Saving" : dirty ? "Save" : "Saved"}
        title="Save · ctrl+s"
        onClick={onSave}
      />
      <div className={styles.kebabWrap} ref={menuRef}>
        <IconButton size="sm" icon="lucide:ellipsis-vertical" label="More actions" aria-expanded={open} onClick={() => setOpen((p) => !p)} />
        {open && (
          <div className={styles.menu} role="menu">
            {menu.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (item) => (
              <MenuItem
                key={item.label}
                disabled={item.disabled === true}
                onClick={() => {
                  setOpen(false);
                  item.onPick();
                }}
              >
                {item.label}
              </MenuItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
