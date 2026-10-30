/** Reusable Skill authoring: activation, full text and persistent model-picked opening share the existing piece save lifecycle. */
import type { JSX } from "react";
import type { SkillBody } from "../../../../entities/skill/schema";
import { PieceFrame } from "./piece-frame";
import { usePieceEditor } from "./use-piece-editor";
import type { KindEditorProps } from "../editors";
import { Textarea, Select } from "../../../components/rc-controls";
import { Toggle } from "../../../components/button";
import { CodeEditor } from "../../../components/code-editor";
import { MacroChips } from "./macro-chips";
import { SkillConditionEditor } from "./skill-condition";
import s from "./piece.module.css";
export function SkillEditor({ entity, revision, ctx, piece, topRight }: KindEditorProps): JSX.Element {
  const session = usePieceEditor<SkillBody>({ kind: "skill", entity, revision, ctx, piece });
  const { body, edit } = session;
  return <PieceFrame kind="Skill" noun="skill" piece={piece} session={session} meta="Reusable instructions" topRight={topRight}><div className={s.page} data-part="piece.skill.editor">
    <Textarea aria-label="Skill description" rows={2} value={body.description} onChange={(e) => edit((b) => ({ ...b, description: e.target.value }))} />
    <CodeEditor label="Skill instructions" value={body.text} onChange={(text) => edit((b) => ({ ...b, text }))} minRows={8} />
    <MacroChips macros={[]} onInsert={(snippet) => edit((b) => ({ ...b, text: b.text + snippet }))} />
    <label>When<Select aria-label="Skill activation" value={body.when} onChange={(e) => edit((b) => ({ ...b, when: e.target.value as SkillBody["when"] }))}><option value="always">Always</option><option value="mentioned">When the chat mentions…</option><option value="picked">When the model opens it</option></Select></label>
    {body.when === "picked" && <><p>The model sees the name and description first. The full text stays open until it closes the Skill. Narrator Tool Access must be on.</p><Toggle label="Close when no longer mentioned" on={body.closeWhenUnmentioned} onChange={(closeWhenUnmentioned) => edit((b) => ({ ...b, closeWhenUnmentioned }))} /></>}
    {(body.when === "mentioned" || (body.when === "picked" && body.closeWhenUnmentioned)) && <SkillConditionEditor value={body} onChange={(condition) => edit((b) => ({ ...b, ...condition }))} />}
  </div></PieceFrame>;
}
