/**
 * "Add or remove trackers" in the Trackers panel (wireframe premiere/scene-pieces.html, 1a): the library's trackers, each with its shape and field count as text ("record, 3 fields": it
 * describes the piece, it is not a limit), a check per tracker that writes the scene's link list (`ChatPrompting.trackers`) through the scene's own prompting writer, and "+ New tracker",
 * which makes a blank tracker and opens it in the Workbench. Under the checks sit the per-reply cost of the linked trackers (the tracker editor's own Prompt rail estimate, `trackerPreview`, summed) and the Built in group: the built-in tracker Props with whether each is on, every row and "All N built-in trackers" opening the existing Props door (the page's Manage features), never a second switch. A linked id the library no longer holds is still listed, so it can be unchecked. Rows are windowed, and each reads its own
 * shape when it scrolls into view, so a large library costs only what is on screen.
 */
import { useEffect, useState, type JSX } from "react";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { createBlank } from "../../../../../_shared/new-piece";
import { VirtualRows } from "../../../../../_shared/virtual-list";
import type { AppContext, StudioEntitySummary } from "../../../../../app-contract";
import { Button, IconButton, ListRow } from "../../../../../components/button";
import type { TrackerBody } from "../../../../../../entities/tracker/schema";
import { trackerPreview } from "../../../../../apps/workbench/pieces/tracker-prompt";
import type { SceneProp } from "../../../props/prop-contract";
import { openDirectorSettings } from "../../../props/story-director/director-live";
import { shapeOf, toggleLinked } from "./library-core";

const ROW_ESTIMATE_PX = 52;

/** One library tracker: its check, and its shape once it has been read. */
function PickRow({ ctx, piece, on, busy, missing, onToggle }: { ctx: AppContext; piece: StudioEntitySummary; on: boolean; busy: boolean; missing: boolean; onToggle(): void }): JSX.Element {
  const [shape, setShape] = useState<string | null>(null);
  useEffect(() => {
    if (missing) return;
    let live = true;
    ctx.api.getEntity(new URLSearchParams({ kind: "tracker", id: piece.id }).toString()).then((entity) => { if (live) setShape(shapeOf(entity)); }, () => undefined);
    return () => { live = false; };
  }, [ctx.api, piece.id, missing]);
  return <ListRow data-part={`scene.messenger.trackers.pick.${piece.id}`} variant="option" selected={on} aria-pressed={on} disabled={busy} label={piece.name} subtitle={missing ? "No longer in the library" : (shape ?? "")} onClick={onToggle} />;
}

export function LibraryPick({ ctx, chat, linked, bodies, builtIn, builtInOn, onChat, onBack }: { ctx: AppContext; chat: Chat; linked: readonly string[]; bodies: readonly TrackerBody[] | null; builtIn: readonly SceneProp[]; builtInOn: readonly string[]; onChat?: (chat: Chat) => void; onBack(): void }): JSX.Element {
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    ctx.api.listEntities("tracker").then((list) => { if (live) setLibrary(list); }, (e: unknown) => { if (live) { setLibrary([]); setProblem(toErrorMessage(e, "The library could not be read.")); } });
    return () => { live = false; };
  }, [ctx.api]);

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try { await work(); } catch (e) { setProblem(toErrorMessage(e, "That could not be saved.")); } finally { setBusy(false); }
  };
  const toggle = (id: string, on: boolean): Promise<void> => run(async () => {
    const next = toggleLinked(linked, id, on);
    const saved = await ctx.api.setScenePrompting(chat.id, { trackers: next.length === 0 ? null : next });
    onChat?.(saved);
  });
  const create = (): Promise<void> => run(async () => {
    const made = await createBlank(ctx, "tracker");
    setLibrary((list) => [...(list ?? []), made]);
    ctx.workbench.open(made);
    ctx.openApp("workbench");
  });

  const held = new Set((library ?? []).map((p) => p.id));
  const rows = library === null ? [] : [...library, ...linked.filter((id) => !held.has(id)).map((id): StudioEntitySummary => ({ id, kind: "tracker", name: id }))];
  return (
    <div className="msn-trk-detail msn-lib-pick" data-part="scene.messenger.trackers.pick">
      <div className="msn-trk-dh"><IconButton data-part="scene.messenger.trackers.back" variant="quiet" size="sm" icon="lucide:arrow-left" label="Back to trackers" onClick={onBack} /><b>Add or remove trackers</b></div>
      <h3 className="msn-lib-group">Your library</h3>
      {problem && <p className="dr-note-line bad" role="alert">{problem}</p>}
      {library === null ? <p className="msn-lib-none" role="status">Loading...</p> : (
        <VirtualRows items={rows} keyOf={(p) => p.id} estimate={ROW_ESTIMATE_PX}
          render={(p) => <PickRow ctx={ctx} piece={p} on={linked.includes(p.id)} busy={busy} missing={!held.has(p.id)} onToggle={() => void toggle(p.id, !linked.includes(p.id))} />} />
      )}
      {library !== null && rows.length === 0 && <p className="msn-lib-none">The library has no trackers yet.</p>}
      {bodies !== null && bodies.length > 0 && <p className="msn-lib-cost" data-part="scene.messenger.trackers.pick.cost">Per reply <b>~{bodies.reduce((sum, b) => sum + trackerPreview(b).tokens, 0)} tokens</b></p>}
      <Button data-part="scene.messenger.trackers.pick.new" size="sm" icon="lucide:plus" disabled={busy} onClick={() => void create()}>New tracker</Button>
      {builtIn.length > 0 && (
        <>
          <h3 className="msn-lib-group">Built in</h3>
          {builtIn.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (p) => <ListRow key={p.id} data-part="scene.messenger.trackers.pick.builtin" variant="picker" label={p.name} subtitle={p.blurb} meta={builtInOn.includes(p.id) ? "On" : undefined} onClick={openDirectorSettings} />)}
          <Button data-part="scene.messenger.trackers.pick.builtin-all" size="sm" variant="quiet" onClick={openDirectorSettings}>All {builtIn.length} built-in trackers</Button>
        </>
      )}
    </div>
  );
}
