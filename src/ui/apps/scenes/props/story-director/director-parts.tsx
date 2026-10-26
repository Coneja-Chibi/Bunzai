/**
 * The small parts every Director tab shares (RoleCall's StoryDirectorWingPanel.tsx "Shared Components": Section, StatusBadge, HorizonBadge, MoodIndicator, and the generic
 * key and value block the Analysis tab draws): a headed section, a tinted badge, the horizon glyph, the mood dot, the activity line and a chevron toggle.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import { Ic, type IconName } from "../../../../_shared/ic";
import type { DirectorActivity, DirectorHorizon } from "../../../../../stage/contracts/director-types";
import { ACTIVITY_LABELS, ACTIVITY_TONES, HORIZON_LOOK, RESULT_TONES, formatAgo, statusTone } from "./director-core";

export function Section({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }): JSX.Element {
  return <section className="dr-sec"><div className="dr-sec-h"><Ic name={icon} size={14} /><span>{title}</span></div>{children}</section>;
}

export const Badge = ({ tone = "mute", children, title }: { tone?: "ok" | "info" | "warn" | "mute" | "danger" | "select"; children: ReactNode; title?: string }): JSX.Element =>
  <span className={`dr-badge ${tone}`} {...(title ? { title } : {})}>{children}</span>;

export const StatusBadge = ({ status }: { status: string }): JSX.Element => <Badge tone={statusTone(status)}>{status}</Badge>;

export const HorizonBadge = ({ horizon }: { horizon: DirectorHorizon }): JSX.Element => {
  const look = HORIZON_LOOK[horizon];
  return <span className="dr-hz" title={`${horizon} horizon`} style={{ "--c": look.tone } as CSSProperties}><Ic name={look.icon} size={14} /></span>;
};

/** RoleCall's MoodIndicator: red for danger, amber for tense, green for calm, violet otherwise. */
export function MoodDot({ mood }: { mood: string }): JSX.Element {
  const m = mood.toLowerCase();
  const tone = m.includes("combat") || m.includes("danger") ? "var(--stage-danger-text)" : m.includes("tense") ? "var(--stage-warn)" : m.includes("calm") || m.includes("ambient") ? "var(--stage-ok)" : "var(--bk-role-brand-text)";
  return <span className="dr-mood" style={{ "--c": tone } as CSSProperties} aria-hidden="true" />;
}

export const Chevron = ({ open }: { open: boolean }): JSX.Element => <span className={`dr-chev${open ? " open" : ""}`}><Ic name="lucide:chevron-down" size={14} /></span>;

/** One line of the feed: the result dot, the type in its color, the turn, the time and the description (RoleCall's ActivityEntryCard and the floating popover's row). */
export function ActivityLine({ entry, now, open, onToggle, clamp }: { entry: DirectorActivity; now: number; open?: boolean; onToggle?: () => void; clamp?: boolean }): JSX.Element {
  const more = onToggle !== undefined && (entry.details !== undefined || entry.model !== undefined);
  return (
    <div className={`dr-act${more ? " more" : ""}`} data-part="scene.director.activity.entry" {...(more ? { role: "button", tabIndex: 0, "aria-expanded": open === true, onClick: onToggle, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } } } : {})}>
      <div className="dr-act-h">
        <span className="dr-act-l">
          <i className="dr-dot" style={{ "--c": RESULT_TONES[entry.result] } as CSSProperties} />
          <b style={{ color: ACTIVITY_TONES[entry.type] }}>{ACTIVITY_LABELS[entry.type]}</b>
          <small>T{entry.turn}</small>
          {more && <Ic name={open ? "lucide:chevron-down" : "lucide:chevron-right"} size={12} />}
        </span>
        <small>{formatAgo(entry.at, now)}</small>
      </div>
      {entry.description && <p className={clamp ? "clamp" : ""}>{entry.description}</p>}
      {open && entry.details && <pre>{entry.details}</pre>}
      {open && entry.model && <div className="dr-act-m">{entry.model}</div>}
    </div>
  );
}

const human = (key: string): string => key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();

/** RoleCall's generic key and value block (Turn Analysis, Pacing Analysis): a string, a list, or a field set, under a small heading each. */
export function KeyValues({ data }: { data: Record<string, unknown> }): JSX.Element {
  return (
    <div className="dr-kv">
      {Object.entries(data).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)).map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ ([key, value]) => (
        <div key={key}>
          <h4>{human(key)}</h4>
          {Array.isArray(value) ? <ul>{value.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (item, i) => <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul> : <p>{typeof value === "string" ? value : String(value)}</p>}
        </div>
      ))}
    </div>
  );
}
