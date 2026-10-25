/**
 * The controls for the Story Director's automatic tracker updates (plan 17), drawn on RoleCall's runtime-box rows. ONE switch ("Update trackers automatically") turns them all on or off; no number
 * stands for "off". On, "Every N replies" is the default for every tracker (1 to 99), a short list shows each tracker switched on in the scene with its own switch and number ("Use default"
 * clears a number that differs from the default), and "Model calls per reply, up to N" caps the model calls the tracker round may spend (1 to 5, repairs included; planning's own call is
 * separate and not shown). Off, only the switch and one line remain. The Booth shows the switch and one quiet line with a way to the settings; a tracker's own menu shows a read-only line
 * (tracker-update-ui.tsx). A number is held as text until it loses focus (or a step button is pressed), then clamped and saved.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import { PROMPT_ORDER, isStoryboard, refreshSpecOf } from "../../../../../core/trackers";
import { TRACKER_PROP_PREFIX, type Chat, type ChatTrackers, type TrackerAuto, type TrackerModule } from "../../../../../stage/contracts/chat-store";
import { DIRECTOR_CALLS_MAX, DIRECTOR_CALLS_MIN, DIRECTOR_EVERY_MAX, type DirectorSettingsPatch } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { Ic } from "../../../../_shared/ic";
import { openDirectorSettings } from "./director-live";
import { legacyProps } from "../trackers/legacy";
import { ToggleSwitch } from "../../../../components/toggle-switch";

type Save = (patch: DirectorSettingsPatch) => Promise<string | null>;
const replies = (n: number): string => (n === 1 ? "reply" : "replies");

/** A whole number with a step button each side; typing is saved when the field loses focus, a step at once. */
function Stepper({ label, value, min, max, lead, unit, disabled, onCommit }: { label: string; value: number; min: number; max: number; lead?: string; unit?: string; disabled?: boolean; onCommit(n: number): void }): JSX.Element {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number): number => Math.min(max, Math.max(min, Math.round(n)));
  const commit = (): void => { const n = Number.parseInt(text ?? "", 10); setText(null); if (!Number.isNaN(n)) onCommit(clamp(n)); };
  return (
    <span className="stp">
      {lead && <span>{lead}</span>}
      <button type="button" aria-label={`Fewer: ${label}`} disabled={disabled || value <= min} onClick={() => onCommit(clamp(value - 1))}>-</button>
      <input type="number" aria-label={label} min={min} max={max} step={1} disabled={disabled} value={text ?? String(value)} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
      <button type="button" aria-label={`More: ${label}`} disabled={disabled || value >= max} onClick={() => onCommit(clamp(value + 1))}>+</button>
      {unit && <small className="unit">{unit}</small>}
    </span>
  );
}

/** The modules the Director can update that are switched on in this scene, in the prompt's order. */
export function listedModules(chat: Pick<Chat, "props">): TrackerModule[] {
  const on = chat.props?.on ?? [];
  return PROMPT_ORDER.filter((m) => !isStoryboard(m) && refreshSpecOf(m) !== undefined && on.includes(`${TRACKER_PROP_PREFIX}${m}`));
}
const propOf = (m: TrackerModule) => legacyProps.find((p) => p.id === `${TRACKER_PROP_PREFIX}${m}`);

/** The `auto` a tracker keeps after a change: nothing stored when it says nothing. */
const autoOf = (on: boolean, every: number | undefined): TrackerAuto | null => (on && every === undefined ? null : { ...(on ? {} : { on: false }), ...(every === undefined ? {} : { every }) });

export function AutoUpdate({ ctx, chat, panel, save, onChat }: { ctx: AppContext; chat: Chat; panel: DirectorPanel; save: Save; onChat?: (chat: Chat) => void }): JSX.Element {
  const s = panel.settings;
  // The last write's answer, kept only while the scene shown is the one it was written against: a newer scene from the parent
  // wins. Derived during render rather than copied by an effect, so a click that lands before React has run the effect can no
  // longer have its answer overwritten by the stale copy.
  const [saved, setSaved] = useState<{ from: ChatTrackers | undefined; trackers: ChatTrackers } | null>(null);
  const trackers = saved && saved.from === chat.trackers ? saved.trackers : chat.trackers ?? {};
  const [error, setError] = useState<string | null>(null);
  const modules = listedModules(chat);
  const write = async (module: TrackerModule, auto: TrackerAuto | null): Promise<void> => {
    try {
      const next = await ctx.api.setSceneTracker(chat.id, module, { auto });
      setSaved({ from: chat.trackers, trackers: next.trackers ?? {} });
      setError(null);
      onChat?.(next);
    } catch {
      setError("Story Director could not be updated.");
    }
  };
  return (
    <div className="ds-aware" data-part="props.story-director.auto-update">
      <div className="ds-row" title="Whether the Story Director updates the trackers that are on after a reply. Off means trackers change only when you edit or Refresh them.">
        <span><Ic name="lucide:refresh-cw" size={12} />Update trackers automatically</span>
        <ToggleSwitch size="sm" on={s.autoUpdate} aria-label="Update trackers automatically" onChange={(autoUpdate) => void save({ autoUpdate })} />
      </div>
      {!s.autoUpdate && <p className="ds-hint">Trackers change only when you edit or Refresh them.</p>}
      {s.autoUpdate && (
        <>
          <div className="ds-row def" title="How many of your replies pass between a tracker's updates. 1 means after every reply; higher numbers use fewer tokens but update less often.">
            <span>Every</span>
            <Stepper label="Every N replies, default for all trackers" value={s.every} min={1} max={DIRECTOR_EVERY_MAX} unit={replies(s.every)} onCommit={(every) => void save({ every })} />
          </div>
          <p className="ds-hint">The default for every tracker below. Change a row to give that tracker its own number.</p>
          <p className="ds-list-h">Trackers in this scene</p>
          <div className="ds-list" data-part="props.story-director.auto-update.list">
            {modules.length === 0 && <p className="ds-hint">No tracker is switched on in this scene.</p>}
            {modules.map((id) => {
              const own = trackers[id]?.auto;
              const on = own?.on !== false;
              const every = own?.every ?? s.every;
              const prop = propOf(id);
              const name = prop?.name ?? id;
              return (
                <div key={id} className={`ds-trow${on ? "" : " off"}`} data-part={`props.story-director.auto-update.row.${id}`}>
                  <b>{prop && <Ic name={prop.icon} size={12} />}{name}</b>
                  <span className="ev">
                    <Stepper label={`${name}, every N replies`} value={every} min={1} max={DIRECTOR_EVERY_MAX} lead="every" unit={replies(every)} disabled={!on}
                      onCommit={(n) => void write(id, autoOf(on, n === s.every ? undefined : n))} />
                    {own?.every !== undefined && own.every !== s.every && on && <button type="button" className="linkish" onClick={() => void write(id, autoOf(on, undefined))}>Use default</button>}
                  </span>
                  <ToggleSwitch size="sm" on={on} aria-label={`${name} automatic updates`} onChange={(next) => void write(id, autoOf(next, own?.every))} />
                </div>
              );
            })}
          </div>
          {error && <p className="ds-err" role="alert">{error}</p>}
          <div className="ds-row" data-part="props.story-director.auto-update.calls" title="The model calls the Story Director may spend updating trackers after one reply, a retry of a bad answer included. Planning is separate.">
            <span><Ic name="lucide:wrench" size={12} />Model calls per reply</span>
            <Stepper label="Model calls per reply" value={s.callsPerReply} min={DIRECTOR_CALLS_MIN} max={DIRECTOR_CALLS_MAX} lead="up to" onCommit={(callsPerReply) => void save({ callsPerReply })} />
          </div>
          <p className="ds-hint">More calls let it handle many trackers and retry a bad answer. Each call costs tokens.</p>
        </>
      )}
    </div>
  );
}

/** The Booth's part: the switch, and one quiet line with the way to the settings. No trackers and no call budget here. */
export function AutoUpdateBooth({ panel, save }: { panel: DirectorPanel; save: Save }): JSX.Element {
  const s = panel.settings;
  return (
    <div className="ds-aware" data-part="scene.booth.narrator.auto-update">
      <div className="ds-row" title="Whether the Story Director updates the trackers that are on after a reply. Off means trackers change only when you edit or Refresh them.">
        <span><Ic name="lucide:refresh-cw" size={12} />Update trackers automatically</span>
        <ToggleSwitch size="sm" on={s.autoUpdate} aria-label="Update trackers automatically" onChange={(autoUpdate) => void save({ autoUpdate })} />
      </div>
      <p className="ds-hint">
        {s.autoUpdate ? `Every ${s.every === 1 ? "reply" : `${s.every} replies`}. ` : "Trackers change only when you edit or Refresh them. "}
        <button type="button" className="linkish" onClick={openDirectorSettings}>Change in Story Director</button>
      </p>
    </div>
  );
}
