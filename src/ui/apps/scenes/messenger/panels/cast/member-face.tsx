/** A member's round face: their color (or gradient) with their first two letters. `big` is the profile card's size. */
import type { JSX } from "react";
import type { RosterRow } from "../../../../../../core/participants/roster";
import { faceFill } from "./members-model";

export const initialsOf = (name: string): string => name.trim().slice(0, 2).toUpperCase() || "?";

export function MemberFace({ row, big }: { row: RosterRow; big?: boolean }): JSX.Element {
  const fill = faceFill(row.shown);
  return <span className="msn-cm-face" data-big={big || undefined} style={fill ? { background: fill } : undefined} aria-hidden="true">{initialsOf(row.name)}</span>;
}
