/**
 * A table dice piece's rows: each row's weight, its result and its chance (its weight over the total), the row the last roll picked lit,
 * and the card under them: add a row, paste a list (one row per line, weight 1), the last roll and Roll. A table has no row limit, so the
 * rows are a windowed list.
 */
import { useRef, useState, type JSX } from "react";
import type { DiceRow } from "../../../../entities/dice/schema";
import { VirtualRows } from "../../../_shared/virtual-list";
import { Button, IconButton } from "../../../components/button";
import { NumberInput } from "../../../components/number-input";
import { Input, Textarea } from "../../../components/rc-controls";
import { numOr } from "../../../../core/guards";
import s from "./piece.module.css";

const ROW_ESTIMATE = 44;
const NEW_ROW: DiceRow = { text: "", weight: 1 };

/** A row's chance as a whole percent of the total weight; blank while the weights add up to nothing. */
const chance = (weight: number, total: number): string => (total > 0 ? `${String(Math.round((weight / total) * 100))}%` : "");

/** The rows a pasted list makes: one per line that has text, weight 1. */
export const rowsFromList = (list: string): DiceRow[] => list.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text) => ({ text, weight: 1 }));

export function DiceTable({ rows, lit, result, canRoll, onChange, onRoll }: {
  rows: readonly DiceRow[];
  /** The row the last roll picked. */
  lit: number | undefined;
  result: string | undefined;
  canRoll: boolean;
  onChange(rows: DiceRow[]): void;
  onRoll(): void;
}): JSX.Element {
  const scroller = useRef<HTMLDivElement>(null);
  const [pasting, setPasting] = useState(false);
  const [list, setList] = useState("");
  const total = rows.reduce((n, r) => n + numOr(r.weight, 0), 0);
  const setRow = (at: number, row: DiceRow): void => onChange(rows.map((r, i) => (i === at ? row : r)));
  const paste = (): void => {
    const added = rowsFromList(list);
    // a table that is only the blank starter row takes the pasted list in its place
    onChange(rows.length === 1 && rows[0]!.text === "" ? added : [...rows, ...added]);
    setList("");
    setPasting(false);
  };
  return (
    <div data-part="piece.dice.table">
      <div className={s.thead}><span>Weight</span><span>Result</span><span>Chance</span><span /></div>
      <div ref={scroller} className={s.rows}>
        <VirtualRows scroll={scroller} items={rows} keyOf={(_, i) => String(i)} estimate={ROW_ESTIMATE}
          render={(row, i) => (
            <div className={i === lit ? `${s.trow} ${s.hit}` : s.trow} data-lit={i === lit || undefined}>
              <NumberInput aria-label="Weight" value={row.weight} onChange={(weight) => setRow(i, { ...row, weight: weight ?? 0 })} />
              <Input aria-label="Result" value={row.text} onChange={(e) => setRow(i, { ...row, text: e.target.value })} />
              <span className={s.pct} data-part="piece.dice.chance">{chance(row.weight, total)}</span>
              <IconButton label="Delete row" icon="lucide:x" size="sm" variant="quiet" onClick={() => onChange(rows.filter((_, at) => at !== i))} />
            </div>
          )} />
      </div>
      {pasting && (
        <div className={s.block}>
          <Textarea aria-label="Rows to paste" rows={4} placeholder="One result per line" value={list} onChange={(e) => setList(e.target.value)} />
          <div className={s.line}>
            <Button size="sm" disabled={rowsFromList(list).length === 0} onClick={paste}>Add rows</Button>
            <Button size="sm" variant="quiet" onClick={() => { setPasting(false); setList(""); }}>Cancel</Button>
          </div>
        </div>
      )}
      <div className={s.rollcard}>
        <Button size="sm" onClick={() => onChange([...rows, NEW_ROW])}>+ Row</Button>
        <Button size="sm" variant="quiet" aria-expanded={pasting} onClick={() => setPasting(!pasting)}>Paste a list...</Button>
        <span className={s.grow} />
        {result && <span className={s.out} role="status">{result}</span>}
        <Button size="sm" variant="primary" disabled={!canRoll} onClick={onRoll}>Roll</Button>
      </div>
    </div>
  );
}
