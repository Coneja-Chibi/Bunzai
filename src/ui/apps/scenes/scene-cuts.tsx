/**
 * Cutting messages (ChatStore rule 11; approved wireframe rc-port/scene-messages.html). RoleCall's
 * delete menu under a message's trash button: "Delete this message" cuts at once; "Delete this & all
 * after" asks RoleCall's "Cut from here?" first, unless Shift is held. A cut leaves a restore line in
 * place for 1 day.
 */
import type { JSX } from "react";
import { Button, MenuItem } from "../../components/button";
import { InkDialog } from "../../components/ink-dialog";
import { Ic } from "../../_shared/ic";

export type CutScope = "one" | "from";

export function DeleteMenu({ onPick }: { onPick(scope: CutScope, skipConfirm: boolean): void }): JSX.Element {
  return (
    <div className="dd" role="menu">
      <MenuItem icon="lucide:trash-2" onClick={(e) => onPick("one", e.shiftKey)}>Delete this message</MenuItem>
      <hr className="menu-rule" />
      <MenuItem danger icon="lucide:trash-2" onClick={(e) => onPick("from", e.shiftKey)}>Delete this &amp; all after</MenuItem>
    </div>
  );
}

/** One line where a cut was: every message of one cut shares it. */
export function CutLine({ count, onRestore }: { count: number; onRestore(): void }): JSX.Element {
  return (
    <div className="cutline">
      <Ic name="lucide:trash-2" size={14} />
      <span>{count === 1 ? "A message was cut here" : `${count} messages were cut here`}</span>
      <small>you can restore {count === 1 ? "it" : "them"} for 1 day</small>
      <span className="grow" />
      <Button size="sm" onClick={onRestore}>Restore</Button>
    </div>
  );
}

export function CutFromDialog({ onCancel, onConfirm }: { onCancel(): void; onConfirm(): void }): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Cut from here">
      <div className="scn-cut">
        <div className="eb">The Cutting Room</div>
        <h3>Cut from <em>here?</em></h3>
        <p>This cuts this message and every one after it. A restore line stays in their place for 1 day.</p>
        <div className="row">
          <Button variant="quiet" autoFocus onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete from here</Button>
        </div>
      </div>
    </InkDialog>
  );
}
