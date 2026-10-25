/** TrackHare's Chains sheet (wireframe state `chains`): the four groups an entry can land in, each
 * row naming what it woke or what woke it and with which word. Presentational; chainGroups (hare-core)
 * does the classifying. */
import type { CSSProperties, JSX, RefObject } from "react";
import { Ic } from "../../../../_shared/ic";
import { DialogCore } from "../../../../components/dialog-core";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { HareLogo } from "./hare-logo";
import { chainGroups, type ChainGroupName } from "./hare-core";

const GROUPS: { id: ChainGroupName; label: string; blurb: string; tone: string }[] = [
  { id: "starters", label: "Starters", blurb: "Fired from the chat, then woke others", tone: "var(--stage-ok)" },
  { id: "links", label: "Links", blurb: "Woken, then woke others", tone: "var(--deck-lorebook)" },
  { id: "ends", label: "Ends", blurb: "Woken, woke nothing", tone: "var(--stage-warn)" },
  { id: "standalone", label: "Standalone", blurb: "Fired alone", tone: "var(--stage-mute)" },
];

export function ChainsSheet({ sheetRef, lore, replyNumber, onClose }: {
  sheetRef: RefObject<HTMLElement | null>;
  lore: SceneTrace["lore"];
  replyNumber: number;
  onClose(): void;
}): JSX.Element {
  const groups = lore ? chainGroups(lore) : null;
  return (
    <DialogCore
      placement="embedded"
      onDismiss={onClose}
      ariaLabel="Chains"
      as="section"
      sheetRef={sheetRef}
      className="sheet"
      tabIndex={-1}
      dismissOnScrim={false}
    >
      <div className="sh-hd">
        <HareLogo size={18} />
        <b>Chains</b>
        <small>Reply #{replyNumber} &middot; an entry&apos;s text can wake another entry&apos;s keys</small>
        <span className="grow" />
        <button type="button" className="tbtn" title="Close" aria-label="Close" onClick={onClose}><Ic name="lucide:x" size={14} /></button>
      </div>
      {groups === null
        ? <div className="hare-none">No lorebooks fired in this reply.</div>
        : (
          <div className="chains">
            {GROUPS.map((g) => (
              <div className="cg" key={g.id} style={{ "--c": g.tone } as CSSProperties}>
                <h4>{g.label}</h4>
                <p>{g.blurb}</p>
                {groups[g.id].length === 0
                  ? <div className="none">None</div>
                  : groups[g.id].map((row) => (
                    <div className="cl" key={row.title}>
                      {row.title}
                      {row.lines.map((line, i) => <small key={i}>{line}</small>)}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
    </DialogCore>
  );
}
