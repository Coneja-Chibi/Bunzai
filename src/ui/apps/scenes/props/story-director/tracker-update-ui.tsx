/**
 * What a tracker's frame draws for the Story Director's automatic updates (plan 16): the line "Updated by the Story Director, reply N" with Undo, in the frame's own Undo strip. The tracker's
 * automatic-update choice (plan 17: on or off, an every override) is a read-only line in its Panel AI settings menu ("Updates automatically every N replies", "Not updated automatically", "Story Director is off")
 * with "Change in Story Director", which opens the Story Director's settings; the controls live only there. Nothing here can be set to zero or forgotten.
 */
import type { JSX } from "react";
import { refreshSpecOf } from "../../../../../core/trackers";
import type { TrackerModule } from "../../../../../stage/contracts/chat-store";
import { Ic } from "../../../../_shared/ic";
import type { TrackerView } from "../trackers/use-tracker";
import { openDirectorSettings } from "./director-live";
import type { TrackerUpdateLine } from "./use-tracker-update";

/** What the tracker's menu says about automatic updates: read only. */
export function AutoUpdateLine({ view, dm }: { view: Pick<TrackerView<unknown>, "module" | "stored">; dm: TrackerUpdateLine }): JSX.Element | null {
  if (!dm.panel || !refreshSpecOf(view.module as TrackerModule)) return null;
  const { on, settings } = dm.panel;
  const own = view.stored?.auto;
  const live = on && settings.autoUpdate && own?.on !== false;
  const every = own?.every ?? settings.every;
  const words = !on ? "Story Director is off" : live ? `Updates automatically every ${every === 1 ? "reply" : `${every} replies`}` : "Not updated automatically";
  return (
    <div className={`trk-ro${live ? "" : " dim"}`} data-part="props.tracker.auto-update">
      <span><Ic name="lucide:refresh-cw" size={14} />{words}</span>
      <button type="button" className="linkish" onClick={openDirectorSettings}>Change in Story Director</button>
    </div>
  );
}

export function DirectorUpdateLine({ dm }: { dm: TrackerUpdateLine }): JSX.Element | null {
  return (
    <>
      {dm.update && (
        <div className="trk-undo" role="status" data-part="props.tracker.director-update">
          <span>Updated by the Story Director, reply {dm.update.turn}</span>
          <button type="button" onClick={() => void dm.undo()}>Undo</button>
        </div>
      )}
      {dm.note?.kind === "refused" && <p className="trk-error" role="alert" data-part="props.tracker.director-update-note">{dm.note.text}<button type="button" className="trk-undo-x" onClick={dm.dismiss}>Dismiss</button></p>}
      {dm.note?.kind === "undone" && <div className="trk-undo" role="status" data-part="props.tracker.director-update-note"><span>{dm.note.text}</span><button type="button" onClick={dm.dismiss}>Dismiss</button></div>}
    </>
  );
}
