/**
 * The settings-section contract - Settings is built from DROP-IN SECTIONS, one reasonable tab per
 * section, so exposing a new configurable never touches this file. A section is one file in
 * sections/ default-exporting a SettingsSection; sections/registry.ts is the one stated seam
 * (one import line per section). Every control is CALL AND RESPONSE: read the current value from
 * ctx.prefs on mount, write on change (ctx.prefs.set applies it live - the shell repaints theme/
 * accent instantly), and keep the local mirror in sync so the control reflects the pick at once.
 */
import type { JSX, ReactNode } from "react";
import type { AppContext } from "../../app-contract";
import { Segmented } from "../../components/button";
import styles from "./styles.module.css";

export interface SettingsSection {
  /** file/section id ("appearance") */
  id: string;
  /** the tab label ("Appearance") */
  label: string;
  /** tab ordering */
  order: number;
  /** the section's controls; the room mounts this fresh whenever the tab is selected */
  Component: (props: { ctx: AppContext }) => JSX.Element;
}

/** A titled control row: label + hint on the left, the control on the right. */
export function SettingsRow({ label, hint, children }: { label: string; hint: string; children: ReactNode }): JSX.Element {
  return (
    <div className={styles.row} data-sx="row">
      <div className={styles.tx}>
        <div className={styles.label} data-sx="label">{label}</div>
        <div className={styles.hint} data-sx="hint">{hint}</div>
      </div>
      {children}
    </div>
  );
}

/** A house segmented control bound call-and-response to a settings value. */
export function SegControl<T extends string>({
  options,
  current,
  onPick,
  disabled = false,
  label = "Choose one",
}: {
  options: { value: T; label: string }[];
  current: T;
  onPick: (value: T) => void;
  /** Reads as it is but cannot be changed (a setting another one has switched off). */
  disabled?: boolean;
  /** Spoken name of the group. */
  label?: string;
}): JSX.Element {
  return (
    <div data-sx="seg">
      <Segmented label={label} items={options.map((o) => ({ ...o, disabled }))} value={current} onChange={onPick} />
    </div>
  );
}
