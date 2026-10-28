/**
 * The tracker editor (design/wireframes/premiere/piece-editors.html): the shared header, the Identity & settings disclosure, the fields
 * (the field editor a tool shares), and the rail showing what the AI gets. Saving is the small-piece lifecycle (use-piece-editor.ts).
 */
import { useCallback, useMemo, useRef, useState, type JSX } from "react";
import type { TrackerBody, TrackerField } from "../../../../entities/tracker/schema";
import { FieldEditor } from "../../../_shared/field-editor";
import { Disclosure } from "../../../components/button";
import { Panel } from "../../../components/panel";
import type { KindEditorProps } from "../editors";
import { PieceFrame } from "./piece-frame";
import { LinkedScenes } from "./linked-scenes";
import { noAnchors, followFieldRename, followNameRename, type Anchors } from "./tracker-links";
import { trackerPreview } from "./tracker-prompt";
import { TrackerRail } from "./tracker-rail";
import { TrackerSettings } from "./tracker-settings";
import { useLoaded } from "./use-loaded";
import { usePieceEditor } from "./use-piece-editor";
import s from "./piece.module.css";

/** A new field is a number starting at 0, like a new tracker's own. */
/**
 * A prompt line whose macros the engine reports a problem with cannot be saved: the AI would be sent the unresolved text. A macro naming another
 * tracker is let through only when that name is a tracker in the library (it may be linked in the scene); a name that matches none is a typo.
 */
export function promptLineProblem(body: TrackerBody, library: ReadonlySet<string> | null): string | null {
  const preview = trackerPreview(body);
  if (preview.blocking !== null) return `The prompt line has a problem: ${preview.blocking}`;
  const typo = preview.others.find((name) => !library?.has(name.trim().toLowerCase()));
  return typo === undefined ? null : `The prompt line reads a tracker called ${typo}, and there is no tracker with that name.`;
}

const blankField = (name: string): TrackerField => ({ name, description: "", type: "number", default: 0 });

export function TrackerEditor({ entity, revision, ctx, piece, topRight }: KindEditorProps): JSX.Element {
  const names = useLoaded(() => ctx.api.listEntities("tracker"), "the trackers");
  const library = useMemo(() => (names.state === "ready" ? new Set(names.value.filter((p) => p.id !== piece.id).map((p) => p.name.trim().toLowerCase())) : null), [names, piece.id]);
  const check = useCallback((b: TrackerBody) => promptLineProblem(b, library), [library]);
  const session = usePieceEditor<TrackerBody>({ kind: "tracker", entity, revision, ctx, piece, check });
  /** What the prompt line was when the rename going on began, so a name passed through on the way takes no macros (tracker-links.ts). */
  const anchors = useRef<Anchors>(noAnchors());
  const { body, edit } = session;
  const [open, setOpen] = useState(true);
  return (
    <PieceFrame kind="Tracker" noun="tracker" piece={piece} session={session} topRight={topRight} onName={(b, name) => followNameRename(b, anchors.current, name)}
      meta={<>{body.layout === "record" ? "one record" : "a list of rows"}{body.template ? " · custom prompt line" : ""} · <LinkedScenes ctx={ctx} kind="tracker" id={piece.id} /></>}>
      <Panel deck={piece.kind} className={s.flush} data-part="piece.tracker.identity">
        <Disclosure open={open} label="Identity & settings" onClick={() => setOpen(!open)} />
        {open && <TrackerSettings body={body} edit={edit} onTemplate={() => { anchors.current = noAnchors(); }} />}
      </Panel>
      <Panel deck={piece.kind} className={`${s.flush} ${s.cols}`} data-part="piece.tracker.fields">
        <FieldEditor fields={body.fields} make={blankField} onChange={(fields, change) => edit((b) => {
          if (change && "renamed" in change) return followFieldRename({ ...b, fields }, anchors.current, change.renamed);
          anchors.current = noAnchors();
          return { ...b, fields };
        })} />
        <TrackerRail body={body} />
      </Panel>
    </PieceFrame>
  );
}
