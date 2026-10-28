/**
 * The tool editor's Try tab: fill the arguments, press Call it, and read exactly the answer the AI would get. The call goes through the
 * real reader and runner (core/tools.ts), so a bad argument comes back as the same sentence the AI is sent. A tool whose action is a formula
 * needs a scene to read, so it says so and opens the formula, where Try runs it on a scene.
 */
import { useRef, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { recOr } from "../../../../core/guards";
import { readToolCall, runTool, type ToolLinks } from "../../../../core/tools";
import { diceBodySchema } from "../../../../entities/dice/runtime-schema";
import type { ToolBody, ToolField } from "../../../../entities/tool/schema";
import { toErrorMessage } from "../../../_shared/error-message";
import { VirtualRows } from "../../../_shared/virtual-list";
import { Button, Segmented } from "../../../components/button";
import { NumberInput } from "../../../components/number-input";
import { Input, Select } from "../../../components/rc-controls";
import s from "./piece.module.css";

const ARG_ESTIMATE = 64;

type Value = string | number | boolean | undefined;
interface Answer { text: string; bad: boolean }

/** The arguments typed so far as the AI would send them: a field left blank is not sent. */
const rawArgs = (fields: readonly ToolField[], values: Readonly<Record<string, Value>>): Record<string, string | number | boolean> =>
  Object.fromEntries(fields.flatMap((f) => (values[f.name] === undefined || values[f.name] === "" ? [] : [[f.name, values[f.name]!]])));

function ArgInput({ field, value, onChange }: { field: ToolField; value: Value; onChange(next: Value): void }): JSX.Element {
  if (field.type === "number") return <NumberInput aria-label={field.name} value={typeof value === "number" ? value : undefined} onChange={onChange} />;
  if (field.type === "boolean") {
    // not sent is a third answer a switch cannot give: the AI may leave a yes-or-no out
    return <Segmented size="sm" label={field.name} value={value === undefined ? "unset" : value ? "yes" : "no"} onChange={(v) => onChange(v === "unset" ? undefined : v === "yes")} items={[{ value: "unset", label: "Not sent" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />;
  }
  if (field.type === "choice") {
    return (
      <Select aria-label={field.name} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">(not sent)</option>
        {(field.choices ?? []).map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (c) => <option key={c} value={c}>{c}</option>)}
      </Select>
    );
  }
  return <Input aria-label={field.name} className={s.mono} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />;
}

export function ToolTry({ body, ctx, problem, rand }: { body: ToolBody; ctx: AppContext; problem: string | null; rand: () => number }): JSX.Element {
  const [values, setValues] = useState<Record<string, Value>>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { action } = body;

  const openFormula = async (): Promise<void> => {
    const formula = action.kind === "formula" ? await ctx.api.getEntitySummary("formula", action.id).catch(() => null) : null;
    if (formula) ctx.workbench.open(formula);
    else setAnswer({ text: "That formula could not be found.", bad: true });
  };
  const call = async (): Promise<void> => {
    const read = readToolCall(body, rawArgs(body.fields, values));
    if ("error" in read) return setAnswer({ text: read.error, bad: true });
    try {
      const links: ToolLinks = {};
      if (action.kind === "dice") {
        const piece = diceBodySchema.safeParse(recOr(await ctx.api.getEntity(`kind=dice&id=${encodeURIComponent(action.id)}`)).body);
        if (!piece.success) return setAnswer({ text: "That dice piece could not be read.", bad: true });
        links.dice = piece.data;
      }
      setAnswer({ text: runTool(body, read.args, rand, links).text, bad: false });
    } catch (e) {
      setAnswer({ text: toErrorMessage(e, "The tool could not run."), bad: true });
    }
  };

  if (problem) return <p className={s.hint}>Fix the tool first to try it: {problem}</p>;
  if (action.kind === "formula") {
    return (
      <>
        <p className={s.hint}>This tool runs a formula, and a formula reads a scene. Try it in the formula editor, where you pick the scene.</p>
        <Button size="sm" onClick={() => void openFormula()}>Open the formula</Button>
        {answer && <div className={`${s.result} ${s.resultBad}`} role="status">{answer.text}</div>}
      </>
    );
  }
  return (
    <>
      <div ref={scroller} className={s.rows}>
        <VirtualRows scroll={scroller} items={body.fields} keyOf={(f) => f.name} estimate={ARG_ESTIMATE}
          render={(f) => (
            <div className={s.arg}>
              <div className={s.label}>{f.name}</div>
              <ArgInput field={f} value={values[f.name]} onChange={(next) => { setValues({ ...values, [f.name]: next }); setAnswer(null); }} />
            </div>
          )} />
      </div>
      <Button size="sm" variant="primary" onClick={() => void call()}>Call it</Button>
      {answer && <div className={answer.bad ? `${s.result} ${s.resultBad}` : s.result} role="status"><span className={s.mono}>{answer.text}</span></div>}
      {answer && <p className={s.hint}>This is the answer the AI gets back.</p>}
    </>
  );
}
