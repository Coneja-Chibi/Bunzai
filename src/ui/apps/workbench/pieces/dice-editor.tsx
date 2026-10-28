/**
 * The dice editor (design/wireframes/premiere/piece-editors.html): one small page. Roll, Table or Pool, each with its one-line roll card
 * (its fields, the last result, Roll). Rolling is the real piece roll (core/dice-piece.ts), the same call a tool's action makes, on the
 * randomness the host hands in. A piece carries exactly the field its type rolls, so switching type keeps the others aside for the way back.
 */
import { useRef, useState, type JSX } from "react";
import type { DiceBody, DicePool, DiceRow, DiceType } from "../../../../entities/dice/schema";
import { Button, Segmented } from "../../../components/button";
import { NumberInput } from "../../../components/number-input";
import { Input } from "../../../components/rc-controls";
import { Panel } from "../../../components/panel";
import type { KindEditorProps } from "../editors";
import { DiceTable } from "./dice-table";
import { rollCard, type RollCard } from "./dice-roll";
import { PieceFrame } from "./piece-frame";
import { usePieceEditor } from "./use-piece-editor";
import s from "./piece.module.css";

const TYPES: readonly { value: DiceType; label: string }[] = [{ value: "roll", label: "Roll" }, { value: "table", label: "Table" }, { value: "pool", label: "Pool" }];
/** What a type starts with the first time it is chosen. */
const STARTS: { dice: string; rows: DiceRow[]; pool: DicePool } = { dice: "1d20", rows: [{ text: "", weight: 1 }], pool: { count: 3, sides: 6, target: 5 } };

export function DiceEditor({ entity, revision, ctx, piece, topRight, rand = Math.random }: KindEditorProps & { rand?: () => number }): JSX.Element {
  const session = usePieceEditor<DiceBody>({ kind: "dice", entity, revision, ctx, piece });
  const { body, edit, problem } = session;
  const [last, setLast] = useState<{ body: DiceBody; card: RollCard } | null>(null);
  // the last result stays only while the piece is as it was rolled
  const shown = last?.body === body ? last.card : undefined;
  const kept = useRef<Pick<DiceBody, "dice" | "rows" | "pool">>({});
  kept.current = { ...kept.current, ...(body.dice !== undefined ? { dice: body.dice } : {}), ...(body.rows ? { rows: body.rows } : {}), ...(body.pool ? { pool: body.pool } : {}) };
  const setType = (type: DiceType): void => edit((b) => ({
    name: b.name, description: b.description, type,
    ...(type === "roll" ? { dice: kept.current.dice ?? STARTS.dice } : type === "table" ? { rows: kept.current.rows ?? STARTS.rows } : { pool: kept.current.pool ?? STARTS.pool }),
  }));
  const setPool = (change: Partial<DicePool>): void => edit((b) => ({ ...b, pool: { ...b.pool!, ...change } }));
  const roll = (): void => setLast({ body, card: rollCard(body, rand) });
  const rollButton = <Button size="sm" variant="primary" disabled={problem !== null} title={problem ?? undefined} onClick={roll}>Roll</Button>;
  const result = shown && <span className={s.out} role="status">{shown.line}</span>;
  return (
    <PieceFrame kind="Dice" noun="dice piece" piece={piece} session={session} topRight={topRight} meta={body.type}>
      <Panel deck={piece.kind} data-part="piece.dice.page">
        <div className={s.line}>
          <div>
            <div className={s.label}>Kind</div>
            <Segmented size="sm" label="Kind" value={body.type} onChange={setType} items={TYPES} />
          </div>
          <div className={s.grow}>
            <div className={s.label}>What it is for</div>
            <Input aria-label="What it is for" value={body.description} onChange={(e) => edit((b) => ({ ...b, description: e.target.value }))} />
          </div>
        </div>
        {body.type === "roll" && (
          <div className={s.rollcard}>
            <div><div className={s.label}>Dice</div><Input aria-label="Dice" className={s.dice} value={body.dice ?? ""} onChange={(e) => edit((b) => ({ ...b, dice: e.target.value }))} /></div>
            <span className={s.grow} />{result}{rollButton}
          </div>
        )}
        {body.type === "table" && (
          <DiceTable rows={body.rows ?? []} lit={shown?.row} result={shown?.line} canRoll={problem === null} onChange={(rows) => edit((b) => ({ ...b, rows }))} onRoll={roll} />
        )}
        {body.type === "pool" && body.pool && (
          <div className={s.rollcard}>
            <div><div className={s.label}>Dice</div><NumberInput aria-label="Dice" className={s.narrow} value={body.pool.count} onChange={(count) => setPool({ count: count ?? 0 })} /></div>
            <div><div className={s.label}>Sides</div><NumberInput aria-label="Sides" className={s.narrow} value={body.pool.sides} onChange={(sides) => setPool({ sides: sides ?? 0 })} /></div>
            <div><div className={s.label}>Counts at</div><NumberInput aria-label="Counts at" className={s.narrow} value={body.pool.target} onChange={(target) => setPool({ target: target ?? 0 })} /></div>
            <span className={s.grow} />{result}{rollButton}
          </div>
        )}
        <p className={s.hint}>Use it anywhere: link it to a tool, or roll it from a formula. <span className={s.mono}>{"{{roll::2d6}}"}</span> still rolls plain dice in any text.</p>
      </Panel>
    </PieceFrame>
  );
}
