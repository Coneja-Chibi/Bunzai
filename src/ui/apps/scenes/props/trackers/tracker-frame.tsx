/**
 * The frame every tracker panel sits in (RoleCall's ImmersionPanelWrapper, immersion/index.tsx:420-640): the hero with its "<Label> module"
 * eyebrow and the module's description, an action strip (a `~Nt` token chip, the panel's own buttons, Panel AI settings, Pop out), the settings
 * drawer (a read-only line about the Story Director's automatic updates, AI Context, Clear All Data with its confirm) and the panel. The line "Updated by the Story Director,
 * reply N" with its Undo shows the last automatic update (plan 16); how often is set in the Story Director's settings (plan 17). RoleCall's "Lorebook" row is not drawn: it saves a value nothing reads. Clear does not erase for good:
 * the state it replaces stays one Undo away, and the Stats log keeps what it changed. Refresh from chat history sits first in the strip (RoleCall's button, with its word),
 * for every module the core can refresh (refresh/).
 */
import { useState, type JSX, type ReactNode } from "react";
import { TRACKER_CONTEXTS, type TrackerContext } from "../../../../../stage/contracts/chat-store";
import { Button, IconButton } from "../../../../components/button";
import { Ic, type IconName } from "../../../../_shared/ic";
import { RefreshButton, RefreshNotice, RefreshOverlay, RefreshSheet } from "./refresh/refresh-ui";
import { useRefresh } from "./refresh/use-refresh";
import type { TrackerView } from "./use-tracker";
import { useTrackerUpdate } from "../story-director/use-tracker-update";
import { AutoUpdateLine, DirectorUpdateLine } from "../story-director/tracker-update-ui";

const CONTEXT_LABELS: Readonly<Record<TrackerContext, string>> = { always: "Always Include", every2: "Every 2 Turns", every5: "Every 5 Turns", never: "Never Include" };

export interface FrameProps {
  /** The module's short label for the eyebrow ("Stats" reads "Stats module"). */
  label: string;
  title: string;
  description: string;
  icon: IconName;
  tone: string;
  /** Tokens the module adds to the prompt (RoleCall counts characters over four). */
  tokens: number;
  view: Pick<TrackerView<unknown>, "module" | "context" | "setContext" | "error" | "undo" | "apply" | "stored" | "host">;
  /** Clear All Data: the module back to what switching it on gives. */
  onClear(): void;
  popOut?: () => void;
  /** A badge at the strip's left (RoleCall's `badge`: Combat's IN COMBAT). */
  badge?: ReactNode;
  /** Buttons for the action strip, left of the settings button (RoleCall's `actions`). */
  actions?: ReactNode;
  children: ReactNode;
}

export function TrackerFrame({ label, title, description, icon, tone, tokens, view, onClear, popOut, badge, actions, children }: FrameProps): JSX.Element {
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const refresh = useRefresh(view, label);
  const dm = useTrackerUpdate(view, label);
  return (
    <div className="trk" data-part={`props.tracker.${view.module}`} style={{ "--w": tone } as React.CSSProperties}>
      <header className="hero">
        <span className="hi"><Ic name={icon} size={20} /></span>
        <div><div className="eb">{label} module</div><h2>{title}</h2><p>{description}</p></div>
      </header>
      <div className="trk-strip">
        <div className="trk-badges">{badge}{tokens > 0 && <span className="trk-tokens">~{tokens}t</span>}</div>
        <div className="trk-actions">
          <RefreshButton r={refresh} label={label} />
          {actions}
          <IconButton size="sm" label="Panel AI settings" icon="lucide:settings" aria-pressed={settings}
            onClick={() => { setSettings(!settings); if (settings) setConfirm(false); }} />
          {popOut && <IconButton size="sm" label="Pop out to floating panel" icon="lucide:external-link" onClick={popOut} />}
        </div>
      </div>
      {settings && (
        <div className="trk-settings">
          <AutoUpdateLine view={view} dm={dm} />
          <label className="trk-row"><span><Ic name="lucide:eye" size={14} /> AI Context</span>
            <select value={view.context} onChange={(e) => view.setContext(e.target.value as TrackerContext)}>
              {TRACKER_CONTEXTS.map((c) => <option key={c} value={c}>{CONTEXT_LABELS[c]}</option>)}
            </select>
          </label>
          <div className="trk-rule" />
          {!confirm ? (
            <Button variant="danger" size="sm" icon="lucide:trash-2" onClick={() => setConfirm(true)}>Clear All Data</Button>
          ) : (
            <div className="trk-confirm">
              <p>This will erase all data for this tracker. Are you sure?</p>
              <div><Button variant="danger" size="sm" onClick={() => { onClear(); setConfirm(false); setSettings(false); }}>Yes, clear</Button>
                <Button variant="quiet" size="sm" onClick={() => setConfirm(false)}>Cancel</Button></div>
            </div>
          )}
        </div>
      )}
      <RefreshNotice r={refresh} label={label} />
      {view.error && <p className="trk-error" role="alert">{view.error}</p>}
      {view.undo && <div className="trk-undo" role="status"><span>{view.undo.label}</span><Button size="sm" onClick={view.undo.run}>Undo</Button></div>}
      <DirectorUpdateLine dm={dm} />
      <div className="trk-body">{children}</div>
      <RefreshOverlay r={refresh} label={title} />
      <RefreshSheet r={refresh} label={label} />
    </div>
  );
}
