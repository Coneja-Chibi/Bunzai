/**
 * One row of the Props wing, to RoleCall's ExtensionRow (StagecraftExtensions.tsx:2120-2200): a 32px tile in the prop's tone, the name,
 * the tier line in small capitals, a gear while the prop is on, and the switch. The whole row switches the prop (a click, Enter or Space
 * on the row itself); the gear and the switch are their own buttons. The hover card is RoleCall's RichTooltip and goes with the wing's
 * Tooltips switch. RoleCall's row handles Enter on its inner buttons too, which turns the prop off when the gear is pressed from the
 * keyboard; here only the row's own keys count (flaw F9).
 */
import type { CSSProperties, JSX, KeyboardEvent, MouseEvent } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import { IconButton, Toggle } from "../../../components/button";
import { reachNotes, type PropReach, type PropTip as PropTipContent } from "./prop-contract";
import { PropTip } from "./prop-tip";

interface RowProps { id: string; name: string; blurb: string; tier: string; icon: IconName; tone: string; tip?: PropTipContent; reach: PropReach; writes?: boolean }

export function PropRow({ prop, on, tips, onToggle, onGear }: { prop: RowProps; on: boolean; tips: boolean; onToggle(): void; onGear?(): void }): JSX.Element {
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onToggle();
  };
  const stop = (fn: () => void) => (e: MouseEvent): void => { e.stopPropagation(); fn(); };
  return (
    <PropTip title={prop.name} tip={prop.tip ?? { description: prop.blurb }} notes={reachNotes(prop)} tone={prop.tone} enabled={tips}>
    <div className="pw-row" role="button" tabIndex={0} style={{ "--tone": prop.tone } as CSSProperties} data-part={`scene.props.row.${prop.id}`} aria-label={`${prop.name}: ${prop.blurb}`} onClick={onToggle} onKeyDown={key}>
      <span className="pw-ic"><Ic name={prop.icon} size={16} /></span>
      <div className="pw-text"><div className="pw-name">{prop.name}</div><div className="pw-tier">{prop.tier}</div></div>
      <div className="pw-end">
        {on && onGear && <IconButton size="sm" label={`Open ${prop.name} panel`} icon="lucide:settings" onClick={stop(onGear)} />}
        <Toggle size="sm" isolate tone="var(--tone)" on={on} aria-label={`${on ? "Turn off" : "Turn on"} ${prop.name}`} onChange={onToggle} />
      </div>
    </div>
    </PropTip>
  );
}

export interface SoonRow { id: string; name: string; icon: IconName; tone: string; tip: PropTipContent }

/** RoleCall's DisabledExtension (:2240): the same row, dimmed, with no switch and a grey gear that does nothing. */
export function SoonPropRow({ row, tips }: { row: SoonRow; tips: boolean }): JSX.Element {
  return (
    <PropTip title={row.name} tip={row.tip} tone={row.tone} enabled={tips}>
    <div className="pw-row soon" style={{ "--tone": row.tone } as CSSProperties} data-part={`scene.props.soon.${row.id}`} aria-label={`${row.name}: ${row.tip.description}`}>
      <span className="pw-ic"><Ic name={row.icon} size={16} /></span>
      <div className="pw-text"><div className="pw-name">{row.name}</div><div className="pw-tier">Coming soon</div></div>
      <div className="pw-end"><span className="pw-gear" aria-hidden="true"><Ic name="lucide:settings" size={14} /></span></div>
    </div>
    </PropTip>
  );
}
