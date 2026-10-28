/**
 * The tool editor (design/wireframes/premiere/piece-editors.html): the shared header, when the AI should use it, the action choice above the
 * field editor a tracker shares, and the rail showing the tool as the AI meets it with a Try tab. A renamed field carries the roll action that
 * reads it; a deleted one leaves the roll with no field picked.
 */
import { useRef, useState, type JSX } from "react";
import type { ToolAction as Action, ToolBody, ToolField } from "../../../../entities/tool/schema";
import { FieldEditor, type FieldChange } from "../../../_shared/field-editor";
import { Disclosure } from "../../../components/button";
import { Textarea } from "../../../components/rc-controls";
import { Panel } from "../../../components/panel";
import type { KindEditorProps } from "../editors";
import { LinkedScenes } from "./linked-scenes";
import { PieceFrame } from "./piece-frame";
import { ToolAction } from "./tool-action";
import { ToolRail } from "./tool-rail";
import { usePieceEditor } from "./use-piece-editor";
import s from "./piece.module.css";

/** A new field is optional text. */
const blankField = (name: string): ToolField => ({ name, description: "", type: "text", required: false });

/** The action as it was when the rename going on began; a rename is many keystrokes, and each follows from there. */
type Anchor = { session: number; action: Action } | null;

/**
 * The roll action after a field change. A rename carries it only if it read the field under the name the rename began with (so a name passed through
 * on the way, a sibling's, takes nothing); a deleted field leaves the roll with no field picked, which is said as a problem.
 */
function followed(action: Action, change: FieldChange | undefined, anchor: { current: Anchor }): Action {
  if (!change || "removed" in change) {
    anchor.current = null;
    return change && action.kind === "roll" && action.field === change.removed ? { kind: "roll", field: "" } : action;
  }
  const { from, to, session } = change.renamed;
  if (anchor.current?.session !== session) anchor.current = { session, action };
  const start = anchor.current.action;
  return start.kind === "roll" && start.field === from ? { kind: "roll", field: to } : action;
}

export function ToolEditor({ entity, revision, ctx, piece, topRight, rand = Math.random }: KindEditorProps & { rand?: () => number }): JSX.Element {
  const session = usePieceEditor<ToolBody>({ kind: "tool", entity, revision, ctx, piece });
  const { body, edit, problem } = session;
  const [open, setOpen] = useState(true);
  const anchor = useRef<Anchor>(null);
  return (
    <PieceFrame kind="Tool" noun="tool" piece={piece} session={session} topRight={topRight}
      meta={<>{{ roll: "rolls the dice it is given", dice: "rolls a dice piece", formula: "runs a formula", record: "notes the call" }[body.action.kind]} · <LinkedScenes ctx={ctx} kind="tool" id={piece.id} /></>}>
      <Panel deck={piece.kind} className={s.flush} data-part="piece.tool.use">
        <Disclosure open={open} label="When the AI should use it" onClick={() => setOpen(!open)} />
        {open && (
          <div className={s.section}>
            <Textarea aria-label="When the AI should use it" rows={3} value={body.description} onChange={(e) => edit((b) => ({ ...b, description: e.target.value }))} />
          </div>
        )}
      </Panel>
      <Panel deck={piece.kind} className={`${s.flush} ${s.cols}`} data-part="piece.tool.fields">
        <FieldEditor tool fields={body.fields} make={blankField}
          onChange={(fields, change) => edit((b) => ({ ...b, fields, action: followed(b.action, change, anchor) }))}
          above={<ToolAction body={body} ctx={ctx} setAction={(action) => { anchor.current = null; edit((b) => ({ ...b, action })); }} />} />
        <ToolRail body={body} ctx={ctx} problem={problem} rand={rand} />
      </Panel>
    </PieceFrame>
  );
}
