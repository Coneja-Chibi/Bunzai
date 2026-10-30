/** Reusable Agent authoring shares the standard save lifecycle and scene model picker. */
import type { JSX } from "react";
import type { AgentBody } from "../../../../entities/agent/schema";
import { presentNum } from "../../../../core/guards";
import { PieceFrame } from "../pieces/piece-frame";
import { usePieceEditor } from "../pieces/use-piece-editor";
import { useLibraryPieces } from "./use-library-pieces";
import type { KindEditorProps } from "../editors";
import { Textarea, Checkbox, Input } from "../../../components/rc-controls";
import { Button } from "../../../components/button";
import { VirtualRows } from "../../../_shared/virtual-list";
import { ModelChoice } from "./model-choice";
import { CodeEditor } from "../../../components/code-editor";
import { MacroChips } from "../pieces/macro-chips";
import s from "./promptbook.module.css";
export function AgentEditor({ entity, revision, ctx, piece, topRight }: KindEditorProps): JSX.Element {
  const session = usePieceEditor<AgentBody>({ kind: "agent", entity, revision, ctx, piece });
  const { body, edit } = session;
  const { pieces, error } = useLibraryPieces(ctx);
  return <PieceFrame kind="Agent" noun="agent" piece={piece} session={session} meta="Reusable personality" topRight={topRight}><div className={s.root} data-part="agent.editor">
    <Textarea aria-label="Agent description" rows={2} value={body.description} onChange={(e) => edit((b) => ({ ...b, description: e.target.value }))} />
    <CodeEditor label="Agent instructions" minRows={8} value={body.instructions} onChange={(instructions) => edit((b) => ({ ...b, instructions }))} />
    <MacroChips macros={[]} onInsert={(snippet) => edit((b) => ({ ...b, instructions: b.instructions + snippet }))} />
    <ModelChoice ctx={ctx} value={body.connection} onChange={(connection) => edit((b) => ({ ...b, connection }))} />
    <Button size="sm" onClick={() => edit(({ connection: _connection, ...b }) => b)}>Use the seat's model</Button>
    <label>Temperature<Input type="number" min={0} max={2} step={0.1} value={body.temperature ?? ""} onChange={(e) => edit((b) => ({ ...b, temperature: presentNum(e.target.valueAsNumber) }))} /></label>
    <label>Recent messages<Input aria-label="Agent context messages" type="number" min={0} placeholder="Same as scene" value={body.contextMessages ?? ""} onChange={(e) => edit((b) => ({ ...b, contextMessages: presentNum(e.target.valueAsNumber) }))} /></label>
    {error && <p role="alert">{error}</p>}
    <VirtualRows items={pieces.filter((p) => p.kind === "tool" || p.kind === "skill")} keyOf={(p) => `${p.kind}/${p.id}`} estimate={44} render={(p) => { const field = p.kind === "tool" ? "tools" : "skills"; return <label><Checkbox checked={body[field].includes(p.id)} onChange={(e) => edit((b) => ({ ...b, [field]: e.target.checked ? [...b[field], p.id] : b[field].filter((id) => id !== p.id) }))} />{p.kind}: {p.name}</label>; }} />
  </div></PieceFrame>;
}
