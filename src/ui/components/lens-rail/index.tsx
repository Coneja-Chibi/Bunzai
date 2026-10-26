/**
 * LensRail - the narrow-pane form of the platform lens strip: one line of chips that scrolls
 * sideways with an edge fade, never a stacked word-wall (design/vs-mobile-editors.html frame 1).
 * Same contract as PlatformTabs; the editor renders one or the other by pane width.
 */
import { Chip, Segmented } from "../button";
import type { JSX } from "react";
import type { OffTarget } from "../platform-tabs";
import styles from "./styles.module.css";

export interface LensRailProps {
  platforms: ReadonlyArray<{ id: string; label: string }>;
  selected: readonly string[];
  onToggle(id: string): void;
  onClear(): void;
  offTarget: OffTarget;
  onOffTarget(m: OffTarget): void;
}

/** One-line sideways-scrolling lens chips; Bunraku (full card) first, off-target mode at the tail. */
export function LensRail({ platforms, selected, onToggle, onClear, offTarget, onOffTarget }: LensRailProps): JSX.Element {
  return (
    <div className={styles.rail}>
      <div className={styles.scroll} role="group" aria-label="Writing for platform">
        <Chip pressed={selected.length === 0} onClick={onClear}>
          Bunraku
        </Chip>
        {platforms.map((p) => (
          <Chip key={p.id} pressed={selected.includes(p.id)} onClick={() => onToggle(p.id)}>
            {p.label}
          </Chip>
        ))}
        <span className={styles.offt}>
          <Segmented
            size="sm"
            label="Off-target fields"
            value={offTarget}
            onChange={onOffTarget}
            items={[
              { value: "hide", label: "Hide", title: "Hide fields the selected platform can't carry" },
              { value: "dim", label: "Dim", title: "Same as hide for now: off-target fields leave so lean platforms stay lean" },
            ]}
          />
        </span>
      </div>
      <span className={styles.fade} aria-hidden="true" />
    </div>
  );
}
