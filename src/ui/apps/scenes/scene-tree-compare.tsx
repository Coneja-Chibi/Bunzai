/**
 * Compare takes, the Branching Tree row's detail (RoleCall has none, so this reuses the shell of its Compare versions dialog, .cx, and the
 * word diff Final Cut uses, core/final-cut/diff.ts): the messages two takes share, counted, then the rest side by side by position, a pair
 * of the same speaker marked word by word. Read only; opening it switches nothing.
 */
import { useEffect, useState, type JSX } from "react";
import { buildWordDiff } from "../../../core/final-cut/diff";
import { plural } from "../../../core/text";
import type { TakeComparison } from "../../../studio/scene-take-compare";
import type { ScenesApi } from "../../app-contract-scenes";
import { toErrorMessage } from "../../_shared/error-message";
import { Ic } from "../../_shared/ic";
import { InkDialog } from "../../components/ink-dialog";

type Side = NonNullable<TakeComparison["rows"][number]["a"]>;

function Cell({ side, other, which }: { side: Side | null; other: Side | null; which: "a" | "b" }): JSX.Element {
  if (!side) return <section className={`tc-${which} none`}><i>No message</i></section>;
  const marked = other && other.role === side.role && other.text !== side.text;
  return (
    <section className={`tc-${which}`}>
      <h4>{side.role}</h4>
      <pre>
        {marked
          ? buildWordDiff(which === "a" ? side.text : other.text, which === "a" ? other.text : side.text).map((s, i) =>
            s.type === "equal" ? <span key={i}>{s.text}</span> : s.type === (which === "a" ? "removed" : "added") ? (which === "a" ? <del key={i}>{s.text}</del> : <ins key={i}>{s.text}</ins>) : null)
          : side.text}
      </pre>
    </section>
  );
}

export function TakeCompare({ api, chatId, a, b, onClose }: { api: Pick<ScenesApi, "compareTakes">; chatId: string; a: string; b: string; onClose(): void }): JSX.Element {
  const [out, setOut] = useState<TakeComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.compareTakes(chatId, a, b).then((r) => alive && setOut(r), (e: unknown) => alive && setError(toErrorMessage(e, "The takes could not be compared.")));
    return () => { alive = false; };
  }, [api, chatId, a, b]);
  return (
    <InkDialog onDismiss={onClose} ariaLabel="Compare takes" sheetClassName="cx-sheet">
      <div className="cx" data-part="scene.tree.compare">
        <header className="cx-top"><h2>Compare takes</h2><button type="button" aria-label="Close compare takes" onClick={onClose}><Ic name="lucide:x" /></button></header>
        <div className="cx-body">
          {error && <p className="cx-err" role="alert">{error}</p>}
          {!out && !error && <p className="cx-note" role="status">Loading...</p>}
          {out && (
            <>
              <p className="cx-blurb">{out.a.name} ({plural(out.a.messages, "message")}) and {out.b.name} ({plural(out.b.messages, "message")}) have {plural(out.shared, "message")} in common.</p>
              {out.rows.length === 0 && <p className="cx-note">These takes have the same messages.</p>}
              {out.rows.map((r, i) => (
                <div key={i} className="cx-cols tc-row"><Cell side={r.a} other={r.b} which="a" /><Cell side={r.b} other={r.a} which="b" /></div>
              ))}
              {out.truncated && <p className="cx-note">Only the first {out.rows.length} differing messages are shown.</p>}
            </>
          )}
        </div>
      </div>
    </InkDialog>
  );
}
