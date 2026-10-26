/**
 * The platform-tabs strip (vs-editor-2, transcribed): multi-select target platforms plus the
 * off-target treatment control. Tabs come from coverage DATA - this component names no platform.
 * Empty selection = the Bunraku tab is on (the full card, nothing judged). Reusable by
 * any editor kind: lorebooks and presets get the same strip against their own coverage.
 */
import { Chip, Segmented } from "../button";
import type { JSX } from "react";
import styles from "./styles.module.css";

export type OffTarget = "dim" | "hide";

export interface PlatformTabInfo {
  id: string;
  label: string;
}

export interface PlatformTabsProps {
  platforms: PlatformTabInfo[];
  /** selected platform ids (the target set); empty = the full card */
  selected: string[];
  onToggle(id: string): void;
  onClear(): void;
  offTarget: OffTarget;
  onOffTarget(mode: OffTarget): void;
}

/** Multi-select platform lens tabs + the dim/hide off-target switch (vs-editor-2). */
export function PlatformTabs({ platforms, selected, onToggle, onClear, offTarget, onOffTarget }: PlatformTabsProps): JSX.Element {
  return (
    <div className={styles.strip}>
      {/* role parity with LensRail: same contract, same semantics - the two skins must not drift */}
      <div role="group" aria-label="Writing for platform" style={{ display: "contents" }}>
      <Chip
        pressed={selected.length === 0}
        onClick={onClear}
        title="The full Bunraku card: every field kept, nothing dropped"
      >
        Bunraku <i className={styles.hint}>full card</i>
      </Chip>
      {platforms.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (p) => (
        <Chip
          key={p.id}
          pressed={selected.includes(p.id)}
          onClick={() => onToggle(p.id)}
          title={`Target ${p.label}: select every platform you ship to`}
        >
          {p.label}
        </Chip>
      ))}
      </div>
      <span className={styles.offt}>
        <i className={styles.hint}>off-target</i>
        <Segmented
          size="sm"
          label="Off-target fields"
          value={offTarget}
          onChange={onOffTarget}
          items={[
            { value: "hide", label: "Hide", title: "Off-target fields leave the form (recommended)" },
            { value: "dim", label: "Dim", title: "Same as hide for now: off-target fields leave so lean platforms stay lean" },
          ]}
        />
      </span>
    </div>
  );
}
