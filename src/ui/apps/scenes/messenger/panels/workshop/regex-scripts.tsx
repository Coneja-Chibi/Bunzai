/**
 * The Regex Workshop page (approved wireframe messenger-discord/panels.html section 6b): the scene's regex scripts as rows with a drag grip, the script's name and what it is, a switch,
 * Edit and Delete, then New regex script. The rows are the library's regex sets, the same list the Final Cut wing's Regex tab shows, read and written by the same hooks (useSceneRegexPicks,
 * useRegexActions): the switch is the scene's own pick (ChatStore rule 42), the grip saves the person's order, Edit opens the Workbench, Delete removes the set from the library. A set's
 * place and timing live inside it in the Workbench and are not drawn here.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../../../app-contract";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import { protect } from "../../../../../_shared/protected-control";
import { Button, IconButton, Toggle } from "../../../../../components/button";
import { InkDialog } from "../../../../../components/ink-dialog";
import { useRegexActions } from "../../../scene-regex-actions";
import { useSceneRegexPicks } from "../../../use-scene-regex-picks";

export function RegexScripts({ ctx, chat, onChat }: { ctx: AppContext; chat: Chat; onChat(chat: Chat): void }): JSX.Element {
  const picks = useSceneRegexPicks(ctx, chat, onChat);
  const { list, error, ask, setAsk, dragging, setDragging, toggle, edit, make, remove, drop, gripKey } = useRegexActions(ctx, picks);
  const { library } = picks;
  if (library.state === "loading") return <p className="msn-wk-quiet" role="status">Loading regex scripts...</p>;
  if (library.state === "failed") {
    return <div className="msn-wk-quiet" role="alert" data-part="scene.messenger.workshop.regex.error">{library.why} <Button variant="quiet" size="sm" onClick={picks.reload}>Try again</Button></div>;
  }
  return (
    <div className="msn-rx" data-part="scene.messenger.workshop.regex">
      <div className="msn-rx-cap">Scripts <span>{list.length}</span></div>
      {list.map((s) => {
        const on = picks.on.includes(s.id);
        const rules = s.facts?.regex?.ruleCount;
        const about = [s.facts?.description, rules === undefined ? undefined : `${rules} ${rules === 1 ? "rule" : "rules"}`].filter(Boolean).join(" · ");
        return (
          <div key={s.id} className="msn-rx-row" data-on={on} data-dragging={dragging === s.id} data-part="scene.messenger.workshop.regex.row" onDragOver={(e) => dragging && e.preventDefault()} onDrop={(e) => drop(e, s.id)}>
            <IconButton variant="quiet" size="sm" icon="lucide:grip-vertical" draggable title="Drag to reorder" label={`Drag ${s.name} to reorder`} onDragStart={() => setDragging(s.id)} onDragEnd={() => setDragging(null)} onKeyDown={(e) => gripKey(e, s.id)} />
            <div className="msn-rx-tx"><b>{s.name}</b>{about && <small>{about}</small>}</div>
            <span {...protect("regex-switches", "msn-rx-mt")}>
              <Toggle on={on} aria-label={`${on ? "Switch off" : "Switch on"} ${s.name} for this scene`} onChange={() => toggle(s.id)} />
              <Button size="sm" onClick={() => edit(s)} aria-label={`Edit ${s.name}`}>Edit</Button>
              <IconButton variant="danger" size="sm" icon="lucide:trash-2" label={`Delete ${s.name}`} title="Delete" onClick={() => setAsk(s)} />
            </span>
          </div>
        );
      })}
      <div><Button variant="primary" onClick={make}>New regex script</Button></div>
      {list.length === 0 && <div className="msn-rx-none"><b>No regex scripts yet</b><small>Create or import regex scripts to get started.</small></div>}
      {error && <p className="msn-wk-quiet" role="alert">{error}</p>}
      {ask && (
        <InkDialog onDismiss={() => setAsk(null)} ariaLabel="Delete regex script">
          <div className="scn-cut">
            <div className="eb">{ask.name}</div>
            <h3>Delete <em>script?</em></h3>
            <p>Are you sure you want to delete this regex script? It is removed from your library, so every scene that uses it loses it.</p>
            <div className="row">
              <Button autoFocus onClick={() => setAsk(null)}>Cancel</Button>
              <span {...protect("regex-switches")}><Button variant="danger" onClick={() => void remove(ask)}>Delete</Button></span>
            </div>
          </div>
        </InkDialog>
      )}
    </div>
  );
}
