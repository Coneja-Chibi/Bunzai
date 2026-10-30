/** Library-backed phase cards: the book stores references, and the existing piece editors own their content. */
import { useState, type JSX } from "react";
import { BOOK_CARD_KINDS, type BookCard, type BookPhase } from "../../../../entities/promptbook/schema";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { kindOf } from "../../../../generated/kinds";
import { Button, Toggle } from "../../../components/button";
import { Select } from "../../../components/rc-controls";
import { VirtualRows } from "../../../_shared/virtual-list";
import { useLibraryPieces } from "./use-library-pieces";
import { createBlank } from "../../../_shared/new-piece";
import { toErrorMessage } from "../../../_shared/error-message";
import { moveItem } from "../../../../core/list-ops";
import { canGroupCard, cardGroupProblem, withoutBookCard } from "../../../../core/promptbook";
import { emptySkillCondition } from "../../../../entities/skill/schema";
import { SkillConditionEditor } from "../pieces/skill-condition";
import s from "./promptbook.module.css";

export function BookCards({ phase, ctx, onChange, expanded }: { phase: BookPhase; ctx: AppContext; onChange(p: BookPhase): void; expanded: boolean }): JSX.Element {
  const { pieces, error } = useLibraryPieces(ctx);
  const [kind, setKind] = useState<BookCard["kind"] | "agent">("scriptsheet");
  const [picking, setPicking] = useState(false);
  const label = (kind: string) => kind === "scriptsheet" ? "Prompt" : kindOf(kind)?.singular ?? kind;
  const add = (piece: StudioEntitySummary) => { onChange(kind === "agent" ? { ...phase, agentId: piece.id } : { ...phase, cards: [...phase.cards, { id: crypto.randomUUID(), kind, pieceId: piece.id, enabled: true }] }); setPicking(false); };
  return <section className={s.cards} data-part="promptbook.cards"><h3>Cards</h3><p>{expanded ? "Each card links to a reusable piece in your Library." : "Add the prompts, skills, tools, dice and trackers this phase uses."}</p>
    {error && <p role="alert">{error}</p>}
    {phase.agentId && <article className={s.card}><small>Agent · Run by</small><strong>{pieces.find((p) => p.kind === "agent" && p.id === phase.agentId)?.name ?? phase.agentId}</strong></article>}
    <VirtualRows items={phase.cards} keyOf={(c) => c.id} estimate={expanded ? 110 : 60} render={(c, i) => {
      const piece = pieces.find((p) => p.kind === c.kind && p.id === c.pieceId);
      return <article className={s.card} data-kind={c.kind} data-joined={c.joinPrevious === true}><small>{label(c.kind)}{c.joinPrevious ? " · Together" : ""}</small><strong>{piece?.name ?? `Unavailable piece: ${c.pieceId}`}</strong><div className={s.toolbar}><Toggle label={`Use card ${piece?.name ?? c.pieceId}`} on={c.enabled} onChange={(enabled) => onChange({ ...phase, cards: phase.cards.map((p) => p.id === c.id ? { ...p, enabled } : p) })} /><Button size="sm" disabled={!piece} onClick={() => piece && ctx.workbench.open(piece)}>Edit piece</Button><Button size="sm" disabled={i === 0} onClick={() => { const cards = moveItem(phase.cards, i, i - 1); const problem = cardGroupProblem(cards); if (problem) ctx.setStatus(problem + " Ungroup this card first."); else onChange({ ...phase, cards }); }}>Move card up</Button><Button size="sm" variant="quiet" onClick={() => onChange({ ...phase, cards: withoutBookCard(phase.cards, c.id) })}>Remove card</Button></div>{["scriptsheet", "skill"].includes(c.kind) && <Toggle label="Together with previous Prompt or Skill" on={c.joinPrevious === true} disabled={!canGroupCard(phase.cards, i)} onChange={(joinPrevious) => onChange({ ...phase, cards: phase.cards.map((p) => p.id === c.id ? { ...p, joinPrevious } : p) })} />}<details><summary>When this card is used</summary><Toggle label="Use a card condition" on={c.condition !== undefined} onChange={(on) => onChange({ ...phase, cards: phase.cards.map((p) => p.id === c.id ? { ...p, condition: on ? emptySkillCondition() : undefined } : p) })} />{c.condition && <SkillConditionEditor value={c.condition} onChange={(condition) => onChange({ ...phase, cards: phase.cards.map((p) => p.id === c.id ? { ...p, condition } : p) })} />}</details></article>;
    }} />
    <div className={s.toolbar}><Select aria-label="Card kind" value={kind} onChange={(e) => setKind(e.target.value as BookCard["kind"] | "agent")}>{[...BOOK_CARD_KINDS, "agent"].map(/* bounded-ok: the supported card types */ (id) => <option key={id} value={id}>{label(id)}</option>)}</Select><Button size="sm" onClick={() => setPicking(!picking)}>{picking ? "Close picker" : "Add card"}</Button></div>
    <Button size="sm" variant="quiet" onClick={() => void createBlank(ctx, kind).then((piece) => ctx.workbench.open(piece), (e: unknown) => ctx.setStatus(toErrorMessage(e, "Could not create this card.")))}>New {kindOf(kind)?.singular}</Button>
    {picking && <div className={s.picker}><VirtualRows items={pieces.filter((p) => p.kind === kind)} keyOf={(p) => p.id} estimate={40} render={(piece) => <Button block variant="quiet" onClick={() => add(piece)}>{piece.name}</Button>} />{!pieces.some((p) => p.kind === kind) && <p>No {kindOf(kind)?.plural.toLowerCase()} yet. Create one in the Library first.</p>}</div>}
  </section>;
}
