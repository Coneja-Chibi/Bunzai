/**
 * The composer's "+" menu (RoleCall's tools popover, one list for the one composer): a button that opens a
 * sectioned list of the reply tools from composer-tools-core.ts. A row that cannot run now is disabled and
 * carries its reason as its title. Whether the menu is open lives with the page's composer hook, so the
 * shortcuts can stand down while it is.
 */
import type { JSX } from "react";
import type { Perspective } from "../../../core/draft-prompts";
import { Ic, type IconName } from "../../_shared/ic";
import { PerspectivePill } from "./scene-draft-status";
import { composerSections, type ComposerRow } from "./composer-tools-core";

export interface ComposerToolsProps {
  open: boolean;
  rows: ComposerRow[];
  onToggle(): void;
  onPick(id: ComposerRow["id"]): void;
  /** Expand as character: the row picks the 1st person, the inline pill the one it names. */
  onExpand(perspective: Perspective): void;
}

const ICONS: Partial<Record<ComposerRow["id"], IconName>> = { continue: "lucide:chevrons-right", correct: "lucide:wrench", "expand-character": "lucide:drama", polish: "lucide:sparkles", inspector: "lucide:eye" };
/** The row's icon tile colour, RoleCall's iconBg per row (ImmersiveChatboxCapsule.tsx:850-1080): violet for the reply tools, cyan for Expand as character, emerald for Polish. */
const TONES: Partial<Record<ComposerRow["id"], string>> = { "expand-character": "action", polish: "ok", inspector: "mute" };

export function ComposerTools({ open, rows, onToggle, onPick, onExpand }: ComposerToolsProps): JSX.Element {
  return (
    <span className="hold">
      <button type="button" className={`tools${open ? " on" : ""}`} aria-label="Open tools menu" title="Open chat tools such as re-rolls and continues." aria-expanded={open} onClick={onToggle}><Ic name="lucide:plus" /></button>
      {open && (
        <div className="menu cm" role="menu" data-part="scene.composer.tools">
          {composerSections(rows).map(({ label, rows: group }) => (
            <div key={label} role="group" aria-label={label}>
              <div className="sec">{label}</div>
              {group.map((r) => (
                <div key={r.id} className="cm-row">
                  <button type="button" role="menuitem" disabled={r.disabled !== undefined} title={r.disabled} onClick={() => (r.id === "expand-character" ? onExpand("1st") : onPick(r.id))}>
                    <i className="ct" data-tone={TONES[r.id] ?? "select"}><Ic name={ICONS[r.id] ?? "lucide:rotate-ccw"} size={14} /></i><span><b>{r.label}</b>{r.sublabel && <small>{r.sublabel}</small>}</span>
                  </button>
                  {r.id === "expand-character" && <PerspectivePill disabled={r.disabled !== undefined} onPick={onExpand} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
