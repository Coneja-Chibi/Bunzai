/**
 * What a tool does when the AI calls it: one choice (roll the dice the AI gives in a field, roll a dice piece, run a formula, or just note
 * the call), and only the picker that choice needs. The dice and formula pickers list the library's pieces; a piece that is gone stays
 * named so the person sees the link is broken rather than a blank.
 */
import { useRef, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { ToolAction as Action, ToolBody } from "../../../../entities/tool/schema";
import { Segmented } from "../../../components/button";
import { Select } from "../../../components/rc-controls";
import { useLoaded } from "./use-loaded";
import s from "./piece.module.css";

type Choice = Action["kind"];

const CHOICES: readonly { value: Choice; label: string }[] = [
  { value: "roll", label: "Roll the dice it gives" }, { value: "dice", label: "Roll a dice piece" }, { value: "formula", label: "Run a formula" }, { value: "record", label: "Just note it" },
];

/** What each choice last held, kept aside so switching away and back finds the same piece or field again. */
type Kept = { roll?: string; dice?: string; formula?: string };

/** The action a choice starts as: a piece choice starts with no piece picked (said as a problem until it is), and a roll on the field it last read, else the first text field. */
function startAction(choice: Choice, body: ToolBody, kept: Kept): Action {
  if (choice === "roll") return { kind: "roll", field: kept.roll ?? body.fields.find((f) => f.type === "text")?.name ?? "" };
  if (choice === "record") return { kind: "record" };
  return { kind: choice, id: kept[choice] ?? "" };
}

function PiecePicker({ label, noun, pieces, value, onPick }: { label: string; noun: string; pieces: readonly StudioEntitySummary[]; value: string; onPick(id: string): void }): JSX.Element {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onPick(e.target.value)}>
      {!pieces.some((p) => p.id === value) && <option value={value}>{value ? `(${noun} not found)` : `Pick a ${noun}`}</option>}
      {pieces.map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  );
}

export function ToolAction({ body, ctx, setAction }: { body: ToolBody; ctx: AppContext; setAction(action: Action): void }): JSX.Element {
  const dice = useLoaded(() => ctx.api.listEntities("dice"), "the dice pieces");
  const formulas = useLoaded(() => ctx.api.listEntities("formula"), "the formulas");
  const { action } = body;
  const kept = useRef<Kept>({});
  if (action.kind === "roll") kept.current.roll = action.field;
  else if (action.kind !== "record") kept.current[action.kind] = action.id;
  const listed = (found: typeof dice): readonly StudioEntitySummary[] => (found.state === "ready" ? found.value : []);
  const pick = (choice: Choice): void => {
    if (choice !== action.kind) setAction(startAction(choice, body, kept.current));
  };
  return (
    <div data-part="piece.tool.action">
      <div className={s.label}>When the AI calls it</div>
      <Segmented size="sm" label="When the AI calls it" value={action.kind} onChange={pick} items={CHOICES} />
      {action.kind === "roll" && (
        <div className={s.block}>
          <div className={s.label}>Which field holds the dice</div>
          <Select aria-label="Which field holds the dice" value={action.field} onChange={(e) => setAction({ kind: "roll", field: e.target.value })}>
            {!body.fields.some((f) => f.name === action.field && f.type === "text") && <option value={action.field}>{action.field ? `(${action.field} is not a text field)` : "Pick a text field"}</option>}
            {body.fields.filter((f) => f.type === "text").map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (f, i) => <option key={i} value={f.name}>{f.name}</option>)}
          </Select>
          <p className={s.hint}>Like 2d6 or 1d20+3. Dice it cannot read are sent back to the AI to fix.</p>
        </div>
      )}
      {action.kind === "dice" && (
        <div className={s.block}>
          <div className={s.label}>Dice piece</div>
          <PiecePicker label="Dice piece" noun="dice piece" pieces={listed(dice)} value={action.id} onPick={(id) => setAction({ kind: "dice", id })} />
          {dice.state === "failed" && <p className={s.hint}>{dice.why}</p>}
          <p className={s.hint}>Rolled the same way as pressing Roll on the piece.</p>
        </div>
      )}
      {action.kind === "formula" && (
        <div className={s.block}>
          <div className={s.label}>Formula</div>
          <PiecePicker label="Formula" noun="formula" pieces={listed(formulas)} value={action.id} onPick={(id) => setAction({ kind: "formula", id })} />
          {formulas.state === "failed" && <p className={s.hint}>{formulas.why}</p>}
          <p className={s.hint}>Runs on a copy of the scene: it reads everything, changes nothing.</p>
        </div>
      )}
      {action.kind === "record" && <p className={s.hint}>The call is kept in the reply&apos;s trace and the AI is told it was noted. Nothing else happens.</p>}
    </div>
  );
}
