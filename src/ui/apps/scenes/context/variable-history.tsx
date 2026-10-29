/**
 * One variable's history in State's fold (Bunzai's own; RoleCall keeps only the current value): the changes the take's replies made to it, newest first, each as the reply's number, the
 * value before and after, and when. Read when the fold opens, from the `variables` record each reply's trace stored, so a variable changed before that record existed shows nothing
 * for those replies. A failed read says why; the read is capped to the newest replies and says so.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { VariableHistory as History } from "../../../app-contract-scenes";
import { dateTimeStamp } from "../scene-meta-core";
import { previewInspectorValue } from "../../../../core/macros/inspector";

type Load = { state: "loading" } | { state: "failed"; why: string } | { state: "ready"; history: History };

const show = (v: unknown, fallback: string): string => (v === undefined ? fallback : previewInspectorValue(v, 80));

export function VariableHistory({ ctx, chatId, scope, storedKey }: { ctx: AppContext; chatId: string; scope: "local" | "global"; storedKey: string }): JSX.Element {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    ctx.api.getSceneVariableHistory(chatId, scope, storedKey).then(
      (history) => { if (live) setLoad({ state: "ready", history }); },
      (e: unknown) => { if (live) setLoad({ state: "failed", why: e instanceof Error && e.message ? e.message : "The history could not be read." }); },
    );
    return () => { live = false; };
  }, [ctx, chatId, scope, storedKey]);
  if (load.state === "loading") return <p className="ls-meta">Reading history</p>;
  if (load.state === "failed") return <p className="ls-err" role="alert">{load.why}</p>;
  const { entries, truncated } = load.history;
  return (
    <div className="ls-histbox">
      {entries.length === 0 ? <p className="ls-meta">No changes recorded for this variable in this take's replies.</p> : (
        <ol className="ls-hist">
          {entries.map((e) => (
            <li key={e.messageId}><b>#{e.number}</b><span>{show(e.before, "(not set)")} → {e.deleted ? "(deleted)" : show(e.after, "(not set)")}</span><small>{dateTimeStamp(e.at)}</small></li>
          ))}
        </ol>
      )}
      {truncated && <p className="ls-meta">Only the newest 400 replies were read.</p>}
    </div>
  );
}
