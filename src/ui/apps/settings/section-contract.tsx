/**
 * The settings-section contract - Settings is built from DROP-IN SECTIONS, one reasonable tab per
 * section, so exposing a new configurable never touches this file. A section is one file in
 * sections/ default-exporting a SettingsSection; sections/registry.ts is the one stated seam
 * (one import line per section). Every control is CALL AND RESPONSE: read the current value from
 * ctx.prefs on mount, write on change (ctx.prefs.set applies it live - the shell repaints theme/
 * accent instantly), and keep the local mirror in sync so the control reflects the pick at once.
 *
 * A section also says where it sits in the rail (its act), what its page is called and what it is for, and, when it holds
 * a host-protected form, the one line that says what is protected. The room draws all of that; no section draws its own rail entry.
 */
import type { JSX, ReactNode } from "react";
import type { AppContext } from "../../app-contract";
import { Segmented } from "../../components/button";
import { Ic } from "../../_shared/ic";
import styles from "./styles.module.css";

/** The four acts of the rail, in order: what each tab is for. */
export const SETTINGS_ACTS = [
  { id: "studio", label: "Your studio" },
  { id: "agent", label: "The agent" },
  { id: "vault", label: "The vault" },
  { id: "house", label: "The house" },
] as const;
export type SettingsAct = (typeof SETTINGS_ACTS)[number]["id"];

export interface SettingsSection {
  /** file/section id ("appearance") */
  id: string;
  /** the tab label ("Appearance") */
  label: string;
  /** ordering inside its act */
  order: number;
  /** which act of the rail the tab belongs to */
  act: SettingsAct;
  /** the page title ("How it looks") */
  title: string;
  /** one line under the page title: what the tab is for ("" when the section says it itself, as Remote access does by its state) */
  lede: string;
  /** set on a tab whose form is a host-protected surface: what is protected and why (drawn as the lock line; the rail marks the tab) */
  protectedNote?: string;
  /** the rail's one-line status for the tab, from non-secret prefs only; nothing when there is nothing cheap to say */
  status?(ctx: AppContext): string | undefined;
  /** the section's controls; the room mounts this fresh whenever the tab is selected */
  Component: (props: { ctx: AppContext }) => JSX.Element;
}

/** The lock line that opens a protected page or panel: a gold left edge, no frame. */
export function ProtectedLine({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className={styles.protectedLine} data-part="settings.protected">
      <Ic name="lucide:lock" size={16} />
      <span><b>Protected.</b> {children}</span>
    </p>
  );
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
