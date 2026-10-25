/**
 * The Control Booth's Narrator section (RoleCall's QuickPlayPanel "Narrator", QuickPlayPanel.tsx:2200-2273): the Story Director row ("Scene direction and narrator context") with its switch, and
 * while it is on the personality picker, the Story Director Model (with Reasoning) and RoleCall's runtime box (QuickPlayPanel.tsx:1392-1490: the automatic tracker update switch and its line, DM Temperature, Auto-retry; auto-update.tsx, director-runtime.tsx). It is the
 * Props wing's own switch and the same settings (ChatStore rules 21 and 47), so the Booth keeps no copy. RoleCall's sub-label also says "storyboards", which the Director does not drive in this release, and its Booth has no command mode or instructions; neither does this one.
 */
import { useState, type CSSProperties, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { DIRECTOR_PROP_ID } from "../../../../../core/director/settings";
import { Ic } from "../../../../_shared/ic";
import { toErrorMessage } from "../../../../_shared/error-message";
import { DirectorModel, DirectorReasoning } from "./director-model";
import { AutoUpdateBooth } from "./auto-update";
import { AutoRetryRow, RuntimeNumbers } from "./director-runtime";
import { PersonalityPicker } from "./personality-picker";
import { useDirectorPanel } from "./use-director-panel";
import { ToggleSwitch } from "../../../../components/toggle-switch";

export function DirectorBooth({ ctx, chat, busy, onProps }: { ctx: AppContext; chat: Chat; busy: boolean; /** The Props changed here: the page reads them again. */ onProps(): void }): JSX.Element {
  const data = useDirectorPanel(ctx, chat);
  const [error, setError] = useState<string | null>(null);
  const panel = data.load.state === "ready" ? data.load.panel : null;
  const on = panel?.on === true;
  const flip = async (): Promise<void> => {
    try {
      const now = await ctx.api.getSceneProps(chat.id);
      await ctx.api.setSceneProps(chat.id, on ? now.on.filter((id) => id !== DIRECTOR_PROP_ID) : [...now.on, DIRECTOR_PROP_ID]);
      setError(null);
      data.reload();
      onProps();
    } catch (e) {
      setError(`Story Director could not be updated: ${toErrorMessage(e)}`);
    }
  };
  const save = async (patch: Parameters<typeof data.settings>[0]): Promise<string | null> => {
    const why = await data.settings(patch);
    setError(why);
    return why;
  };
  return (
    <section className="bth-sec" data-part="scene.booth.narrator">
      <h3>Narrator</h3>
      <div className="prop-row" style={{ "--tone": "var(--deck-persona)" } as CSSProperties} data-part="scene.booth.narrator.director">
        <span className="prop-ic"><Ic name="mdi:drama-masks" size={20} /></span>
        <div><b>Story Director</b><small>Scene direction and narrator context</small></div>
        <ToggleSwitch size="sm" tone="var(--tone)" on={on} aria-label={`${on ? "Turn off" : "Turn on"} the Story Director`} disabled={panel === null || busy} onChange={() => void flip()} />
      </div>
      {busy && on && <p className="bth-note" role="status">A reply is being written. Changes apply from the next reply.</p>}
      {panel && on && (
        <div className="ds" data-part="scene.booth.narrator.settings">
          <PersonalityPicker value={panel.settings.personality} onPick={(personality) => void save({ personality })} />
          <DirectorModel ctx={ctx} chat={chat} panel={panel} save={save} label="Story Director Model" description="AI model for narrative direction." />
          <DirectorReasoning panel={panel} save={save} />
          <div className="ds-runtime" data-part="scene.booth.narrator.runtime"><AutoUpdateBooth panel={panel} save={save} /><RuntimeNumbers panel={panel} save={save} /><AutoRetryRow panel={panel} save={save} /></div>
        </div>
      )}
      {data.load.state === "failed" && <p className="bth-note warn" role="alert">{data.load.why}</p>}
      {error && <p className="bth-note warn" role="alert">{error}</p>}
    </section>
  );
}
