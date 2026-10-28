/**
 * The tool editor's rail. The AI sees: the call name a provider is handed, what it takes as plain lines read off the parameters the provider gets, and what the
 * definition costs on every reply. Try: fill the arguments and call it (tool-try.tsx).
 */
import { useMemo, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { callName, toolParameters } from "../../../../core/tools";
import type { ToolBody } from "../../../../entities/tool/schema";
import { Tabs } from "../../../components/button";
import { toolTakes } from "./tool-takes";
import { toolTokens } from "./tool-cost";
import { ToolTry } from "./tool-try";
import s from "./piece.module.css";

type View = "sees" | "try";

export function ToolRail({ body, ctx, problem, rand }: { body: ToolBody; ctx: AppContext; problem: string | null; rand: () => number }): JSX.Element {
  const [view, setView] = useState<View>("sees");
  const name = callName(body.name);
  const seen = useMemo(() => ({
    takes: toolTakes(toolParameters(body.fields)),
    tokens: toolTokens(body),
  }), [body]);
  return (
    <aside className={s.rail} aria-label="The tool as the AI meets it" data-part="piece.tool.rail">
      <Tabs label="The tool as the AI meets it" value={view} onChange={setView} items={[{ value: "sees", label: "The AI sees" }, { value: "try", label: "Try" }]} />
      {view === "sees" ? (
        <>
          <div className={s.label}>Tool name</div>
          <div className={`${s.prose} ${s.mono}`}>{name}</div>
          <div className={s.label}>What it takes</div>
          <pre className={s.prose} aria-label="What it takes">{seen.takes}</pre>
          <div className={s.cost}><span>Adds to every reply</span><b>~{seen.tokens}</b></div>
        </>
      ) : (
        <ToolTry body={body} ctx={ctx} problem={problem} rand={rand} />
      )}
    </aside>
  );
}
