/**
 * The formula editor (design/wireframes/premiere/piece-editors.html): the formula text in the app's code editor with the macro chips under
 * it, and the Try it rail. Try runs the text on a copy of the scene you pick, through the same read-only formula path a tool call takes,
 * and shows the result, how long it took, or the words for why it stopped. It reads the scene and changes nothing.
 */
import { useState, type JSX } from "react";
import type { FormulaBody } from "../../../../entities/formula/schema";
import type { AppContext } from "../../../app-contract";
import { toErrorMessage } from "../../../_shared/error-message";
import { Button } from "../../../components/button";
import { CodeEditor, type MacroHint } from "../../../components/code-editor";
import { Input, Select } from "../../../components/rc-controls";
import { Panel } from "../../../components/panel";
import type { KindEditorProps } from "../editors";
import { MacroChips } from "./macro-chips";
import { PieceFrame } from "./piece-frame";
import { useLoaded } from "./use-loaded";
import { usePieceEditor } from "./use-piece-editor";
import s from "./piece.module.css";

/** The macros a formula reaches for most: the chat-watching ones, odds, and a tracker's value. Offered as chips and in the editor's autocomplete. */
const FORMULA_MACROS: readonly MacroHint[] = [
  { sig: "mentions::word::n", desc: "How many of the last n messages say the word" },
  { sig: "lastmention::word", desc: "How long ago the word was last said" },
  { sig: "tally::a,b,c", desc: "Which of these words is said most" },
  { sig: "odds::percent", desc: "True this percent of the time" },
  { sig: "tracker::name::field", desc: "A linked tracker's field" },
];

type Ran = { text: string; chatId: string; ok: boolean; said: string; ms: number };

function TryRail({ body, ctx }: { body: FormulaBody; ctx: AppContext }): JSX.Element {
  const scenes = useLoaded(() => ctx.api.listScenes(), "the scenes");
  const [chatId, setChatId] = useState("");
  const [ran, setRan] = useState<Ran | null>(null);
  const [running, setRunning] = useState(false);
  const run = async (): Promise<void> => {
    setRunning(true);
    const text = body.text;
    try {
      const out = await ctx.api.tryFormula(chatId, text);
      setRan({ text, chatId, ok: out.ok, said: out.ok ? out.text : out.error, ms: out.ms });
    } catch (e) {
      setRan({ text, chatId, ok: false, said: toErrorMessage(e, "The scene could not be read."), ms: 0 });
    } finally {
      setRunning(false);
    }
  };
  // a result belongs to the text and scene it ran on
  const shown = ran && ran.text === body.text && ran.chatId === chatId ? ran : null;
  return (
    <aside className={s.rail} aria-label="Try it" data-part="piece.formula.try">
      <h3 className={s.railTitle}>Try it</h3>
      <div className={s.label}>Run against</div>
      <Select aria-label="Run against" value={chatId} onChange={(e) => setChatId(e.target.value)}>
        <option value="">{scenes.state === "loading" ? "Reading scenes..." : "Pick a scene"}</option>
        {scenes.state === "ready" && scenes.value.map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}
      </Select>
      {scenes.state === "failed" && <p className={s.hint}>{scenes.why}</p>}
      <Button size="sm" variant="primary" disabled={!chatId || running} onClick={() => void run()}>Run</Button>
      {shown && (
        <div className={shown.ok ? s.result : `${s.result} ${s.resultBad}`} role="status">
          <b className={s.mono}>{shown.ok ? shown.said || "(empty)" : `Stopped: ${shown.said}`}</b>
          {shown.ms > 0 || shown.ok ? <span className={s.after}>{shown.ms} ms</span> : null}
        </div>
      )}
      <p className={s.hint}>Uses a copy of that scene. Nothing in the scene changes.</p>
    </aside>
  );
}

export function FormulaEditor({ entity, revision, ctx, piece, topRight }: KindEditorProps): JSX.Element {
  const session = usePieceEditor<FormulaBody>({ kind: "formula", entity, revision, ctx, piece });
  const { body, edit } = session;
  const setText = (text: string): void => edit((b) => ({ ...b, text }));
  return (
    <PieceFrame kind="Formula" noun="formula" piece={piece} session={session} topRight={topRight} meta="reads the chat">
      <Panel deck={piece.kind} className={`${s.flush} ${s.cols} ${s.colsPair}`} data-part="piece.formula.page">
        <div className={s.page}>
          <div>
            <div className={s.label}>What it is for</div>
            <Input aria-label="What it is for" value={body.description} onChange={(e) => edit((b) => ({ ...b, description: e.target.value }))} />
          </div>
          <div>
            <div className={s.label}>Formula</div>
            <CodeEditor value={body.text} onChange={setText} macros={FORMULA_MACROS} label="Formula" placeholder="{{calc::1 + 1}}" minRows={4} />
            <MacroChips macros={FORMULA_MACROS} onInsert={(snippet) => setText(body.text + snippet)} />
          </div>
          <p className={s.hint}>A formula reads the scene and never changes it. If it tries to set a variable, it says which macro did and stops.</p>
        </div>
        <TryRail body={body} ctx={ctx} />
      </Panel>
    </PieceFrame>
  );
}
