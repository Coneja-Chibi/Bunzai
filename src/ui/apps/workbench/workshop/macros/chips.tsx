/**
 * Macro snippet chips + expand preview line for Workshop value fields.
 */
import { Chip } from "../../../../components/button";
import type { JSX } from "react";
import styles from "./chips.module.css";
import { expandAgainstVars, MACRO_CHIPS, stillHasMacro } from "./expand";

export interface MacroAssistProps {
  value: string;
  onInsert(snippet: string): void;
  /** Test Bench vars for live expand */
  vars: ReadonlyArray<{ name: string; value: string }>;
}

export function MacroAssist({ value, onInsert, vars }: MacroAssistProps): JSX.Element {
  const expanded = value.includes("{{") ? expandAgainstVars(value, vars) : "";
  return (
    <div className={styles.macroAssist}>
      <div className={styles.macroChips}>
        {MACRO_CHIPS.map((c) => (
          <Chip key={c.id} title={c.insert} onClick={() => onInsert(c.insert)}>{c.label}</Chip>
        ))}
      </div>
      {value.includes("{{") && (
        <p className={styles.macroPreview}>
          expands to:{" "}
          <b>{stillHasMacro(expanded) ? expanded : expanded || "(empty)"}</b>
        </p>
      )}
    </div>
  );
}
