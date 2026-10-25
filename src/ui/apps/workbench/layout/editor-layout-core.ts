/**
 * The pure half of EditorLayout: the section shape every editor declares, which section is open, how arrow keys
 * move between sections, which bento column a section sits in, and the percentage a stat-sheet meter draws.
 * No React, no DOM; the component only renders what these return.
 */
import type { ReactNode } from "react";

export interface EditorSection {
  /** stable id; also the DOM id suffix and the key the open section is remembered by */
  id: string;
  title: string;
  /** a short numeral or glyph shown beside the title in the variants that number sections ("I", "II") */
  no?: string;
  /** one line under the title in the variants that have room for it */
  hint?: string;
  /** the "has content" dot on the card header */
  filled?: boolean;
  /** greyed by the platform lens: still rendered and reachable */
  dim?: boolean;
  /** header chips (core bento cards only) */
  aff?: ReactNode;
  /** the bento column in the core frame: 1 is the middle column (default), 2 the right one */
  column?: 1 | 2;
  /** the section's fields, with no card or heading of their own; the layout wraps them */
  node: ReactNode;
}

export interface FieldMeter { value: number; min: number; max: number }

/** The open section: the asked-for one if it still exists, else the first. Empty list gives null. */
export function resolveActive(sections: readonly EditorSection[], activeId: string | null): string | null {
  return sections.find((s) => s.id === activeId)?.id ?? sections[0]?.id ?? null;
}

/** The section a navigation key lands on, or null when the key is not a navigation key. Up/Left step back, Down/Right forward, both ends wrap. */
export function navTarget(ids: readonly string[], current: string, key: string): string | null {
  const at = ids.indexOf(current);
  if (at < 0 || ids.length === 0) return null;
  if (key === "Home") return ids[0]!;
  if (key === "End") return ids[ids.length - 1]!;
  if (key === "ArrowUp" || key === "ArrowLeft") return ids[(at - 1 + ids.length) % ids.length]!;
  if (key === "ArrowDown" || key === "ArrowRight") return ids[(at + 1) % ids.length]!;
  return null;
}

/** Core bento split: the middle column (default) and the right column, each in declared order. */
export function bentoColumns(sections: readonly EditorSection[]): [EditorSection[], EditorSection[]] {
  return [sections.filter((s) => (s.column ?? 1) === 1), sections.filter((s) => s.column === 2)];
}

/** Meter fill as a whole percent, clamped to 0..100; a flat or inverted range draws empty. */
export function meterPercent({ value, min, max }: FieldMeter): number {
  if (!(max > min) || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, (value - min) / (max - min))) * 100);
}
