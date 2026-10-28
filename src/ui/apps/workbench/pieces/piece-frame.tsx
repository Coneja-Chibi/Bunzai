/**
 * The frame every small piece editor wears: the shared editor header (the piece's monogram, name, one meta line, save state, the pane's
 * controls), the conflict bar when something else saved the piece first, and the one sentence saying why a draft cannot be saved yet.
 * What goes below the header is the editor's own.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { useAccentVars } from "../../../_shared/use-scoped-accents";
import { EditorEhead } from "../../../components/editor-ehead";
import { EditorConflict } from "../editor-conflict";
import type { PieceSession } from "./use-piece-editor";
import s from "./piece.module.css";

export function PieceFrame<B extends { name: string }>({ kind, noun, piece, session, meta, topRight, onName, children }: {
  /** The kind's name for the header's kicker ("Tracker"). */
  kind: string;
  /** What the conflict bar calls the piece ("tracker"). */
  noun: string;
  piece: StudioEntitySummary;
  session: PieceSession<B>;
  meta: ReactNode;
  topRight?: ReactNode;
  /** How a new name reaches the body, for a piece whose name is also written elsewhere in it (a tracker's prompt line); absent, the name alone changes. */
  onName?: (body: B, name: string) => B;
  children: ReactNode;
}): JSX.Element {
  const accentVars = useAccentVars();
  const { body, edit, dirty, saving, conflict, problem } = session;
  return (
    <div className={s.root} data-part={`piece.${piece.kind}`} style={accentVars(piece.accent) as CSSProperties | undefined}>
      <EditorEhead kind={kind} deck={piece.kind} mark={(body.name.trim()[0] ?? kind[0]!).toUpperCase()} name={body.name}
        onNameChange={(name) => edit((current) => (onName ? onName(current, name) : { ...current, name }))} namePlaceholder={`Untitled ${noun}`} nameAriaLabel={`${kind} name`}
        meta={meta} dirty={dirty} saving={saving} onSave={() => void session.save()} topRight={topRight} />
      {conflict && <EditorConflict what={noun} onTakeTheirs={() => void session.takeTheirs()} onKeepMine={() => void session.keepMine()} />}
      {dirty && problem && <p className={s.problem} role="status">{problem}</p>}
      {children}
    </div>
  );
}
