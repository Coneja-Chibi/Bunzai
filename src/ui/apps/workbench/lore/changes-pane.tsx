/**
 * Changes pane: facing From/To panels from diffBooks (vs-lore-changes).
 * Baseline is the body as it arrived this sitting (importBaseline).
 */
import { Button, IconButton, ListRow } from "../../../components/button";
import { useMemo, type JSX, type ReactNode } from "react";
import { VirtualRows } from "../../../_shared/virtual-list";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { diffBooks, type FieldChange } from "../../../../core/lore";
import styles from "./changes-pane.module.css";

/** One line of the windowed pane: an edited entry with its fields, a swap, an added entry or a removed one. */
type ChangeRow = { key: string; node: ReactNode };
const ROW_ESTIMATE_PX = 120;

export interface ChangesPaneProps {
  baseline: LorebookBody;
  body: LorebookBody;
  onRevertField: (entryId: string, field: keyof LorebookEntry, value: unknown) => void;
  onRestoreEntry: (entry: LorebookEntry) => void;
  onUndoSwap: (aId: string, bId: string) => void;
  onJumpEntry: (entryId: string) => void;
  onClose: () => void;
}

function highlight(
  text: string,
  ranges: [number, number][] | undefined,
  kind: "del" | "ins",
): JSX.Element {
  if (!ranges || ranges.length === 0) {
    return <span>{text || "-"}</span>;
  }
  const parts: JSX.Element[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) {
      parts.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    }
    parts.push(
      <span key={`h${i}`} className={kind === "del" ? styles.del : styles.ins}>
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}

function FieldRow({
  change,
  entryId,
  onRevert,
}: {
  change: FieldChange;
  entryId: string;
  onRevert: () => void;
}): JSX.Element {
  return (
    <div className={styles.field}>
      <div className={styles.fieldK}>{String(change.field)}</div>
      <div className={styles.diffCols}>
        <div className={styles.dFrom}>
          {highlight(change.fromText, change.words?.fromRanges, "del")}
        </div>
        <div className={styles.dTo}>
          {highlight(change.toText, change.words?.toRanges, "ins")}
        </div>
      </div>
      <Button size="sm" onClick={onRevert}>Revert</Button>
    </div>
  );
}

export function ChangesPane({
  baseline,
  body,
  onRevertField,
  onRestoreEntry,
  onUndoSwap,
  onJumpEntry,
  onClose,
}: ChangesPaneProps): JSX.Element {
  const diff = useMemo(() => diffBooks(baseline, body), [baseline, body]);
  const empty =
    diff.edited.length === 0 &&
    diff.reordered.length === 0 &&
    diff.added.length === 0 &&
    diff.removed.length === 0;

  const rows: ChangeRow[] = [
    ...diff.edited.map((ed): ChangeRow => {
      const title = body.entries.find((e) => e.id === ed.entryId)?.title || ed.wasTitle || ed.entryId;
      return { key: `edited:${ed.entryId}`, node: (
        <section className={styles.block}>
          <ListRow onClick={() => onJumpEntry(ed.entryId)} label={`${title}${ed.wasTitle ? ` (was ${ed.wasTitle})` : ""}`} />
          {ed.changes.map(/* bounded-ok: fixed category set, per-item detail, capped or short by construction */ (ch) => (
            <FieldRow key={String(ch.field)} change={ch} entryId={ed.entryId} onRevert={() => onRevertField(ed.entryId, ch.field, ch.from)} />
          ))}
        </section>
      ) };
    }),
    ...diff.reordered.map((pair): ChangeRow => ({ key: `swap:${pair.aId}-${pair.bId}`, node: (
      <div className={styles.swap}>
        <span>Order swapped</span>
        <Button size="sm" onClick={() => onUndoSwap(pair.aId, pair.bId)}>Undo swap</Button>
      </div>
    ) })),
    ...diff.added.map((id): ChangeRow => ({ key: `added:${id}`, node: <div className={styles.added}>Added: {body.entries.find((e) => e.id === id)?.title || id}</div> })),
    ...diff.removed.map((e): ChangeRow => ({ key: `removed:${e.id}`, node: (
      <div className={styles.removed}>
        <span>Removed: {e.title || e.id}</span>
        <Button size="sm" onClick={() => onRestoreEntry(e)}>Bring back</Button>
      </div>
    ) })),
  ];

  return (
    <aside className={styles.pane} aria-label="Changes">
      <div className={styles.head}>
        <b>Changes</b>
        <i>since this sitting opened</i>
        <IconButton label="Close changes" variant="quiet" size="sm" icon="lucide:x" onClick={onClose} />
      </div>
      {empty && <p className={styles.clean}>No changes yet this sitting.</p>}

      <VirtualRows items={rows} keyOf={(r) => r.key} estimate={ROW_ESTIMATE_PX} render={(r) => r.node} />
    </aside>
  );
}
