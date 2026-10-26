/**
 * The Workbench's Desk / Nodes switch, rendered in the editor's top-right slot and in the Nodes head row.
 */
import { Segmented } from "../../../components/button";
import type { JSX } from "react";
import type { View } from "./canvas-state";
import css from "./nodes.module.css";

export function ViewSwitch({ view, onChange }: { view: View; onChange(view: View): void }): JSX.Element {
  return (
    <Segmented
      label="Workbench view"
      size="sm"
      items={[
        { value: "desk", label: "Desk" },
        { value: "nodes", label: "Nodes" },
      ]}
      value={view}
      onChange={(v) => view !== v && onChange(v)}
    />
  );
}
