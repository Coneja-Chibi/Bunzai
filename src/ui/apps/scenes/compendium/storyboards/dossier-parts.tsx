/**
 * What the four dossiers draw with (RoleCall `components/compendium/dossiers/shared/*`): the stat row (DossierStatRow, DossierStatTile), the section title
 * (DossierSectionHeader), a meter, the tab strip (DossierTabStrip) and the AI Context panel (AIContextPanel.tsx:30-134), whose pills are Off, Focused,
 * Compact, Radius and Full and whose preview is the exact text the narrator gets. RoleCall's Recent History panel is not here: it reads the Story
 * Director's journal.
 */
import { Fragment, type CSSProperties, type JSX, type ReactNode } from "react";
import { CONTEXT_MODES, RADIUS_CHOICES, profileLabel, type ContextMode, type ContextProfile, type DossierAiContext } from "../../../../../core/compendium/dossiers";

export type Tone = "ok" | "warn" | "danger" | "pink" | "link" | "macro" | "gold";
const TONE: Readonly<Record<Tone, string>> = { ok: "var(--stage-ok)", warn: "var(--stage-warn)", danger: "var(--stage-danger-text)", pink: "var(--deck-character)", link: "var(--stage-link)", macro: "var(--stage-macro)", gold: "var(--stage-warn)" };
export const toneVar = (t: Tone): CSSProperties => ({ "--c": TONE[t] } as CSSProperties);

export function StatRow({ tiles }: { tiles: readonly { label: string; value: ReactNode; tone: Tone }[] }): JSX.Element {
  return (
    <div className="sb-stats" style={{ gridTemplateColumns: `repeat(${Math.min(tiles.length, 6)},minmax(0,1fr))` }} data-part="compendium.dossier.stats">
      {tiles.map((t) => <div className="sb-stat" key={t.label} style={toneVar(t.tone)}><small>{t.label}</small><b>{t.value}</b></div>)}
    </div>
  );
}

export function Section({ title, sub, tone = "ok", children }: { title: string; sub?: string; tone?: Tone; children: ReactNode }): JSX.Element {
  return (
    <section className="sb-sec" style={toneVar(tone)} data-part="compendium.dossier.section">
      <h4><span>{title}</span>{sub && <i> - {sub} -</i>}</h4>
      {children}
    </section>
  );
}

export function Meter({ label, value, max = 100, tone }: { label: string; value: number; max?: number; tone: Tone }): JSX.Element {
  return (
    <div className="sb-meter" style={toneVar(tone)}>
      <span>{label}</span>
      <div className="sb-track"><div style={{ width: `${max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0}%` }} /></div>
      <em>{value}</em>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange, label }: { tabs: readonly { id: T; label: string; count?: ReactNode }[]; active: T; onChange(id: T): void; label: string }): JSX.Element {
  return (
    <div className="sb-tabs" role="tablist" aria-label={label} data-part="compendium.dossier.tabs">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={active === t.id ? "on" : ""} onClick={() => onChange(t.id)}>{t.label}{t.count !== undefined && <small>{t.count}</small>}</button>
      ))}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }): JSX.Element => <p className="sb-empty">{children}</p>;

/** RoleCall's marker colouring for the preview (AIContextPanel.tsx:renderAiContextText): [BRACKETS] and {slugs} are set apart. */
function Colored({ text }: { text: string }): JSX.Element {
  return <>{text.split(/(\[[^\]\n]+\]|\{[^}\n]+\})/g).map((part, i) => (
    <Fragment key={i}>{/^\[[^\]\n]+\]$/.test(part) ? <span className="sb-mark">{part}</span> : /^\{[^}\n]+\}$/.test(part) ? <span className="sb-slug">{part}</span> : part}</Fragment>
  ))}</>;
}

export function AiPanel({ ai, included, onOff, onMode, onRadius }: {
  ai: DossierAiContext; included: boolean; onOff(): void; onMode(mode: ContextMode): void; onRadius(radius: number): void;
}): JSX.Element {
  const profile: ContextProfile = ai.profile;
  return (
    <section className="sb-ai" data-part="compendium.dossier.ai">
      <div className="sb-ai-head">
        <div className="sb-ai-title">AI Context - what the<br />model is using</div>
        <div className="sb-ai-pills">
          <button type="button" className={!included ? "off" : ""} aria-pressed={!included} onClick={onOff}>Off</button>
          {CONTEXT_MODES.map((m) => <button key={m} type="button" className={included && profile.mode === m ? "on" : ""} aria-pressed={included && profile.mode === m} onClick={() => onMode(m)}>{profileLabel(m)}</button>)}
          {profile.mode === "radius" && (
            <select aria-label="AI context radius" value={profile.radius} onChange={(e) => onRadius(Number(e.target.value))}>
              {(RADIUS_CHOICES as readonly number[]).includes(profile.radius) ? null : <option value={profile.radius}>{profile.radius} lines</option>}
              {RADIUS_CHOICES.map((r) => <option key={r} value={r}>{r} lines</option>)}
            </select>
          )}
        </div>
      </div>
      {ai.text.trim().length === 0 ? <p className="sb-empty">No Storyboards context for this scope yet.</p> : <pre className="sb-ai-text"><Colored text={ai.text} /></pre>}
      <div className="sb-ai-foot">
        <span>{included ? `Storyboards: ${profileLabel(profile.mode)} sent` : "Storyboards: off, not sent to model"}</span>
        <span>~{ai.tokens} tokens</span>
      </div>
    </section>
  );
}
