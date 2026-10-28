/**
 * The macro chips under a piece's macro text (a tracker's prompt line, a formula): each chip adds its macro to the end of the text, and
 * "All macros..." opens the engine's whole reference. The suggestions are the caller's; the reference is the engine's own catalog.
 */
import { useState, type JSX, type ReactNode } from "react";
import { macroGroupsForProfile } from "../../../../core/preset";
import { Button, Chip } from "../../../components/button";
import type { MacroHint } from "../../../components/code-editor";
import { MacroReference } from "../preset/macro-reference";
import s from "./piece.module.css";

export function MacroChips({ macros, onInsert, children }: { macros: readonly MacroHint[]; onInsert(snippet: string): void; children?: ReactNode }): JSX.Element {
  const [all, setAll] = useState(false);
  return (
    <div>
      <div className={s.line}>
        {macros.map(/* bounded-ok: the suggestions the editor passes in, a short fixed list */ (m) => (
          <Chip key={m.sig} title={m.desc} onClick={() => onInsert(`{{${m.sig}}}`)}><code className={s.mono}>{`{{${m.sig}}}`}</code></Chip>
        ))}
        {children}
        <Button size="sm" variant="quiet" aria-expanded={all} onClick={() => setAll(!all)}>All macros...</Button>
      </div>
      {all && <MacroReference groups={macroGroupsForProfile("full")} />}
    </div>
  );
}
