/**
 * The Story tab (RoleCall's OverviewTab, StoryDirectorWingPanel.tsx:540-743): Current Chapter, Chapter History, Current Mood, Suggested Actions (buttons that fill the composer) and DM Intentions.
 * The chapter shown is the one the state points at, else the newest unfinished (VVS-720).
 */
import type { JSX } from "react";
import { Button } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { insertIntoDraft } from "../../context/draft-bus";
import type { DirectorChapter, DirectorState } from "../../../../../stage/contracts/director-types";
import { currentChapter } from "./director-core";
import { Badge, MoodDot, Section, StatusBadge } from "./director-parts";

const goals = (c: DirectorChapter): string[] => c.majorGoal.split("; ").filter(Boolean);

function Themes({ list }: { list: readonly string[] }): JSX.Element | null {
  return list.length === 0 ? null : <div className="dr-chips">{list.map((t, i) => <Badge key={i} tone="select">{t}</Badge>)}</div>;
}

function Goals({ chapter, dim }: { chapter: DirectorChapter; dim?: boolean }): JSX.Element | null {
  const list = goals(chapter);
  return list.length === 0 ? null : <div className={`dr-goals${dim ? " dim" : ""}`}>{list.map((g, i) => <div key={i}><Ic name="lucide:chevron-right" size={12} /><span>{g}</span></div>)}</div>;
}

/** `chatId` is the scene whose composer a suggested action fills; without it the actions stay plain text. */
export function StoryTab({ state, chatId }: { state: DirectorState; chatId?: string }): JSX.Element {
  const now = currentChapter(state.chapters, state.currentChapterId);
  const elapsed = now ? Math.max(now.turnsElapsed, state.turn !== undefined ? state.turn - now.createdAtTurn : 0) : 0;
  const history = state.chapters.filter((c) => c.id !== now?.id).sort((a, b) => b.number - a.number);
  return (
    <div className="dr-pane" data-part="scene.director.story">
      {now && (
        <Section title="Current Chapter" icon="lucide:book-open">
          <div className="dr-card" data-part="scene.director.chapter">
            <div className="dr-row"><b>Ch. {now.number}: {now.title}</b><StatusBadge status={now.status} /></div>
            {(now.premise || now.majorGoal) && <p className="dr-soft">{now.premise || now.majorGoal}</p>}
            <Goals chapter={now} />
            <Themes list={now.themes} />
            <div className="dr-meta">{now.tone && <span>Tone: {now.tone}</span>}{elapsed > 0 && <span>{elapsed} turns elapsed</span>}</div>
          </div>
        </Section>
      )}
      {history.length > 0 && (
        <Section title="Chapter History" icon="lucide:list-ordered">
          <div className="dr-stack">
            {history.map((c) => (
              <div key={c.id} className="dr-card sm">
                <div className="dr-row"><b>Ch. {c.number}: {c.title}</b><StatusBadge status={c.status} /></div>
                {c.premise && <p className="dr-dim">{c.premise}</p>}
                <Goals chapter={c} dim />
                <Themes list={c.themes} />
                <div className="dr-meta">{c.tone && <span>Tone: {c.tone}</span>}{c.turnsElapsed > 0 && <span>{c.turnsElapsed} turns</span>}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {state.pacing.currentMood && (
        <Section title="Current Mood" icon="lucide:music">
          <div className="dr-mood-row" data-part="scene.director.mood"><MoodDot mood={state.pacing.currentMood} /><span>{state.pacing.currentMood}</span></div>
        </Section>
      )}
      {state.suggestedActions.length > 0 && (
        <Section title="Suggested Actions" icon="lucide:sparkles">
          <div className="dr-stack tight" data-part="scene.director.actions">
            {state.suggestedActions.map((a, i) => chatId === undefined
              ? <div key={i} className="dr-action"><Ic name="lucide:chevron-right" size={12} /><span>{a}</span></div>
              : <Button key={i} variant="quiet" size="sm" block icon="lucide:chevron-right" data-part="scene.director.action" title="Put this in your message. Nothing is sent." onClick={() => { insertIntoDraft(chatId, a); }}>{a}</Button>)}
          </div>
        </Section>
      )}
      {state.nextIntentions.length > 0 && (
        <Section title="DM Intentions" icon="lucide:target">
          <ul className="dr-list" data-part="scene.director.intentions">
            {state.nextIntentions.map((n, i) => <li key={i}>{n.description} <Badge>{n.priority}</Badge> <Badge>{n.targetTurn}</Badge></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
