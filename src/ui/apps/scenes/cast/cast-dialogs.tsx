/**
 * The Cast wing's two small surfaces besides its tabs: the confirm before the scene plays someone else
 * (what changes and what does not, in the approved wireframe's words) and the New persona form (a name
 * and the identity text, then Create or Create and cast).
 */
import { useState, type JSX } from "react";
import { InkDialog } from "../../../components/ink-dialog";
import { Button } from "../../../components/button";
import { Ic } from "../../../_shared/ic";

/** The confirm before the scene plays someone else: what changes and what does not. */
export function CastConfirm({ from, to, onCancel, onConfirm }: { from: string | null; to: string | null; onCancel(): void; onConfirm(): void }): JSX.Element {
  const who = to ?? "no persona";
  return (
    <InkDialog onDismiss={onCancel} ariaLabel={to ? `Play as ${to}` : "Play with no persona"}>
      <div className="scn-sheet gilt" data-part="scene.cast.confirm">
        <header className="hd"><div className="eb"><Ic name="lucide:user" size={16} />Scene cast</div><h2>{to ? `Play as ${to}?` : "Play with no persona?"}</h2>
          <p>From your next message on, the AI sees {to ?? "User"} instead of {from ?? "User"}. This scene only.</p></header>
        <div className="bd">
          <div className="box"><div className="t">What changes</div><ul><li>Everything you already wrote stays under {from ?? "User"}.</li><li>The lorebooks of {who} join the scene, and {from ?? "the previous persona"}&apos;s leave it.</li></ul></div>
          <div className="box"><div className="t">What does not</div><ul><li>Your default persona for new scenes.</li><li>The Library: nothing is saved or deleted.</li></ul></div>
        </div>
        <footer className="ft"><Button variant="quiet" autoFocus onClick={onCancel}>Cancel</Button><Button variant="primary" tone="var(--stage-warn)" onClick={onConfirm}>{to ? `Play as ${to}` : "Play with no persona"}</Button></footer>
      </div>
    </InkDialog>
  );
}

/** The New persona form: a name and the identity text, then Create or Create and cast. */
export function NewPersona({ busy, onCreate, onCancel }: { busy: boolean; onCreate(input: { name: string; content: string }, cast: boolean): void; onCancel(): void }): JSX.Element {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = name.trim() === "";
  return (
    <section className="cw-create" data-part="scene.cast.new">
      <h3>Who will you play?</h3>
      <p className="hint">Saved to your Library. Add the rest of the sheet by choosing the Persona tab afterwards.</p>
      <label className="cw-line"><span className="lb">Stage name</span>
        <input className={touched && missing ? "bad" : undefined} value={name} placeholder="Name" aria-label="Persona name" onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} />
        {touched && missing && <span className="err" role="alert">A name is required.</span>}</label>
      <label className="cw-line"><span className="lb">Identity text</span>
        <textarea className="cw-ta" rows={5} value={content} placeholder="Who they are, in your words. This is what the AI reads." aria-label="Identity text" onChange={(e) => setContent(e.target.value)} /></label>
      <div className="cw-acts">
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
        <Button disabled={missing || busy} onClick={() => onCreate({ name: name.trim(), content }, false)}>Create</Button>
        <Button variant="primary" disabled={missing || busy} onClick={() => onCreate({ name: name.trim(), content }, true)}>Create and cast</Button>
      </div>
    </section>
  );
}
