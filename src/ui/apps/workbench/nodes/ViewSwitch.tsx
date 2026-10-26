/**
 * The Workbench's Desk / Nodes switch, rendered in the editor's top-right slot and in the Nodes head row.
 */
import type { JSX } from "react";
import type { View } from "./canvas-state";
import css from "./nodes.module.css";

export function ViewSwitch({ view, onChange }: { view: View; onChange(view: View): void }): JSX.Element {
  return (
    <span className={css.seg} role="group" aria-label="Workbench view">
      {(["desk", "nodes"] as const).map((v) => (
        <button key={v} type="button" className={view === v ? css.segOn : undefined} aria-pressed={view === v} onClick={() => view !== v && onChange(v)}>
          {v === "desk" ? "Desk" : "Nodes"}
        </button>
      ))}
    </span>
  );
}
