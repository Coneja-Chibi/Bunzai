/**
 * RoleCall's tracker tile (StagecraftExtensions.tsx:895-990, `renderImmersionModuleToggle`): the Legacy Trackers and Storyboards boxes hold their
 * modules as tiles, not rows. A tile is the prop's icon and name; on, it takes the prop's tone, and it gains a gear that opens the module's panel.
 * RoleCall opens a module from a wing icon on the rail, which Bunraku's fixed rail has no room for, so the gear is the way in.
 * A storyboard tile is the taller card with its description and the Live or Off chip.
 */
import type { CSSProperties, JSX, KeyboardEvent, MouseEvent } from "react";
import { Ic } from "../../../_shared/ic";
import { PropTip } from "./prop-tip";
import { reachNotes, type SceneProp } from "./prop-contract";

export function PropTile({ prop, on, tips, onToggle, onGear, subOn }: { prop: SceneProp; on: boolean; tips: boolean; onToggle(): void; onGear?(): void; subOn?: Readonly<Record<string, boolean>> }): JSX.Element {
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onToggle();
  };
  const stop = (fn: () => void) => (e: MouseEvent): void => { e.stopPropagation(); fn(); };
  const story = prop.group === "storyboard";
  const dots = (cls: string): JSX.Element | null => (prop.subs ? <span className={cls} aria-hidden="true">{prop.subs.map((s) => <i key={s.id} className={on && subOn?.[s.id] ? "on" : on ? "up" : ""} />)}</span> : null);
  const tile = (
    <div className={`pw-tile${story ? " story" : ""}${on ? " on" : ""}`} role="button" tabIndex={0} aria-pressed={on} style={{ "--tone": prop.tone } as CSSProperties} data-part={`scene.props.tile.${prop.id}`}
      aria-label={`${prop.name}: ${prop.blurb}`} onClick={onToggle} onKeyDown={key}>
      <div className="pw-tile-head">
        <Ic name={prop.icon} size={story ? 16 : 14} />
        <span className="pw-tile-name">{prop.name}</span>
        {story && <span className="pw-chip">{on ? "Live" : "Off"}</span>}
        {!story && dots("pw-dots")}
        {on && onGear && <button type="button" className="pw-gear" aria-label={`Open ${prop.name} panel`} title={`Open ${prop.name} panel`} onClick={stop(onGear)}><Ic name="lucide:settings" size={14} /></button>}
      </div>
      {story && <p className="pw-tile-blurb">{prop.blurb}</p>}
      {story && dots("pw-dots low")}
    </div>
  );
  return prop.tip ? <PropTip title={prop.name} tip={prop.tip} notes={reachNotes(prop)} tone={prop.tone} enabled={tips}>{tile}</PropTip> : tile;
}
