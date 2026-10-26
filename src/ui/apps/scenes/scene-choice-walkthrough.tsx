/**
 * The guided walkthrough for a preset's choice groups (RoleCall's ChoiceWalkthroughModal, with the step logic of core/preset/choice-stepper.ts):
 * an optional "about this preset" step, one question card per group in declaration order, and a summary. Every pick is saved as it is made
 * (the caller's `onSelect`), so closing midway keeps the progress. Colors come from the theme tokens; corners are square.
 */
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { ChoiceGroup, ChoiceSelections } from "../../../core/macros/choice-groups";
import { strArray } from "../../../core/guards";
import { buildSteps, buildSummary, canAdvance, selectionShortfall, type PromptPeek } from "../../../core/preset/choice-stepper";
import type { ChoicePick } from "../../../stage/contracts/chat-store";
import { Button, Card, Chip, IconButton, Toggle } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { InkDialog } from "../../components/ink-dialog";
import { useDebouncedSave } from "../../_shared/use-debounced-value";

const INPUT_COMMIT_MS = 400;
const ADVANCE_MS = 350;
const isShortLabelGroup = (g: ChoiceGroup): boolean => g.options.every((o) => o.label.length <= 24 && !o.description);

/** Free text: drafts locally and saves debounced and on blur; the saver also saves when the step closes, so closing mid-typing keeps the words. */
function InputStep({ group, value, onCommit }: { group: ChoiceGroup; value: string; onCommit(text: string): void }): JSX.Element {
  const [draft, setDraft] = useState(value);
  const saver = useDebouncedSave<string>(onCommit, INPUT_COMMIT_MS);
  const type = (text: string): void => { setDraft(text); saver.push(text); };
  return (
    <div>
      {group.suggestions && (
        <div className="ch-chips" role="group" aria-label={`${group.label} suggestions`}>
          {group.suggestions.map((s) => <Chip key={s} pressed={draft.trim() === s} onClick={() => { type(s); saver.flush(); }}>{s}</Chip>)}
        </div>
      )}
      <input className="ch-input" type="text" value={draft} placeholder={group.placeholder} aria-label={group.label} onChange={(e) => type(e.target.value)} onBlur={saver.flush} />
      <p className="ch-hint">empty = default: {group.default as string}</p>
    </div>
  );
}

function Previews({ ids, peeks }: { ids: string[]; peeks: Record<string, PromptPeek> }): JSX.Element {
  return (
    <div className="ch-peeks">
      {ids.map((id) => {
        const peek = peeks[id];
        return (
          <div key={id} className="ch-peek">
            <b>{peek ? peek.name : id}</b>
            <pre>{peek ? (peek.content !== "" ? peek.content : "(this prompt is empty)") : "(prompt not found in this preset)"}</pre>
          </div>
        );
      })}
    </div>
  );
}

function PeekButton({ open, onToggle, corner }: { open: boolean; onToggle(): void; corner?: boolean }): JSX.Element {
  const eye = <IconButton variant="quiet" size="sm" label={open ? "Hide prompt" : "View prompt"} icon="lucide:eye" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }} />;
  return corner ? <span className="ch-eye-corner">{eye}</span> : eye;
}

function GroupReadme({ readme }: { readme: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="ch-more">
      <Button variant="quiet" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Read less" : "Read more"}</Button>
      {open && <p>{readme}</p>}
    </div>
  );
}

export function ChoiceWalkthrough({ groups, selections, onSelect, onSave, onClose, readme, presetName, peeks, startAt = 0, onStep }: {
  groups: ChoiceGroup[];
  selections: ChoiceSelections;
  /** Saves one answer as it is made. */
  onSelect(groupId: string, value: ChoicePick): void;
  /** Save & done: keeps the run's answers as the person's defaults for the preset. */
  onSave(): void;
  onClose(): void;
  readme?: string;
  presetName?: string;
  peeks: Record<string, PromptPeek>;
  startAt?: number;
  onStep?(index: number): void;
}): JSX.Element {
  const steps = useMemo(() => buildSteps(groups, readme), [groups, readme]);
  const [index, setIndex] = useState(Math.max(0, Math.min(startAt, steps.length - 1)));
  const [visited, setVisited] = useState<ReadonlySet<number>>(new Set([index]));
  const [openPeeks, setOpenPeeks] = useState<ReadonlySet<string>>(new Set());
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = steps[index] ?? steps[steps.length - 1]!;
  const hasReadme = steps[0]?.kind === "readme";
  useEffect(() => () => { if (advance.current) clearTimeout(advance.current); }, []);
  const goTo = (i: number): void => {
    if (advance.current) { clearTimeout(advance.current); advance.current = null; }
    const at = Math.max(0, Math.min(i, steps.length - 1));
    setIndex(at);
    setVisited((v) => new Set(v).add(at));
    onStep?.(at);
  };
  const peek = (key: string): void => setOpenPeeks((old) => { const next = new Set(old); if (!next.delete(key)) next.add(key); return next; });

  const groupStep = (group: ChoiceGroup): JSX.Element => {
    if (group.type === "input") {
      const value = selections[group.id];
      return <InputStep key={group.id} group={group} value={typeof value === "string" ? value : (group.default as string)} onCommit={(text) => onSelect(group.id, text)} />;
    }
    if (group.type === "toggle") {
      const on = selections[group.id] === true;
      const key = `${group.id}:toggle`;
      return (
        <div>
          <Toggle on={on} card onChange={(next) => onSelect(group.id, next)}><span>{on ? "Enabled" : "Disabled"}</span></Toggle>
          {group.prompts.length > 0 && (
            <>
              <div className="ch-peekrow"><PeekButton open={openPeeks.has(key)} onToggle={() => peek(key)} /><span>View the prompt{group.prompts.length > 1 ? "s" : ""} this switch controls</span></div>
              {openPeeks.has(key) && <Previews ids={group.prompts} peeks={peeks} />}
            </>
          )}
        </div>
      );
    }
    const many = group.type === "select_many";
    return (
      <div role={many ? "group" : "radiogroup"} className={`ch-opts${isShortLabelGroup(group) ? " two" : ""}`}>
        {group.options.map((o) => {
          const picked = many ? strArray(selections[group.id]).includes(o.id) : selections[group.id] === o.id;
          const key = `${group.id}:${o.id}`;
          const has = o.prompts.length > 0;
          return (
            <div key={o.id} className={`ch-optwrap${has ? " eye" : ""}`}>
              <Card kind="choice" role={many ? "checkbox" : "radio"} aria-checked={picked} selected={picked} heading={o.label} subtitle={o.description || undefined}
                onClick={() => {
                  if (many) { const cur = new Set(strArray(selections[group.id])); if (!cur.delete(o.id)) cur.add(o.id); onSelect(group.id, [...cur]); return; }
                  onSelect(group.id, o.id);
                  if (advance.current) clearTimeout(advance.current);
                  advance.current = setTimeout(() => goTo(index + 1), ADVANCE_MS);
                }} />
              {has && <PeekButton open={openPeeks.has(key)} onToggle={() => peek(key)} corner />}
              {has && openPeeks.has(key) && <Previews ids={o.prompts} peeks={peeks} />}
            </div>
          );
        })}
      </div>
    );
  };

  const shortfall = step.kind === "group" ? selectionShortfall(step.group, selections) : 0;
  const blocked = step.kind === "group" && !canAdvance(step.group, selections);
  const question = index + (hasReadme ? 0 : 1);
  return (
    <InkDialog onDismiss={onClose} ariaLabel="Preset choices walkthrough">
      <div className="ch-modal" data-part="scene.choices.walkthrough">
        <div className="ch-head">
          <div className="ch-dots" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => <span key={s.kind === "group" ? s.group.id : s.kind} className={i === index ? "now" : visited.has(i) ? "seen" : ""} />)}
          </div>
          <IconButton variant="quiet" size="sm" label="Close walkthrough" icon="lucide:x" onClick={onClose} />
        </div>
        <div className="ch-body">
          {step.kind === "readme" ? (
            <>
              <div className="eb">About this preset</div>
              <h3>{presetName ?? "Read me"}</h3>
              <p className="ch-prose">{step.readme}</p>
            </>
          ) : step.kind === "group" ? (
            <>
              <div className="eb">Question {question} of {groups.length}</div>
              <h3>{step.group.label}</h3>
              {step.group.description && <p className="ch-desc">{step.group.description}</p>}
              {step.group.readme && <GroupReadme key={step.group.id} readme={step.group.readme} />}
              <div className="ch-step">{groupStep(step.group)}</div>
            </>
          ) : (
            <>
              <div className="eb">Curtain call</div>
              <h3>All set</h3>
              <p className="ch-desc">Here is what this preset will use. You can change any of it later from the panel.</p>
              <div className="ch-sum">
                {buildSummary(groups, selections).map((row) => (
                  <div key={row.groupId} className="ch-row">
                    <div>
                      <b>{row.groupLabel}</b>
                      <span>{row.selectedLabels.length > 0 ? row.selectedLabels.join(", ") : <i>None</i>}{row.isDefault && <small> (default)</small>}</span>
                    </div>
                    <Button variant="quiet" size="sm" onClick={() => goTo(steps.findIndex((s) => s.kind === "group" && s.group.id === row.groupId))}>Change</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ch-foot">
          <div className="ch-left">
            <Button icon="lucide:chevron-left" disabled={index === 0} onClick={() => goTo(index - 1)}>Back</Button>
            {step.kind !== "summary" && <Button variant="quiet" onClick={onClose}>Skip - keep defaults</Button>}
          </div>
          <div className="ch-right">
            {blocked && step.kind === "group" && <span className="ch-need">pick at least {step.group.min ?? shortfall}</span>}
            {step.kind !== "summary"
              ? <Button variant="primary" disabled={blocked} onClick={() => goTo(index + 1)}>Next <Ic name="lucide:chevron-right" size={14} /></Button>
              : <Button variant="primary" icon="lucide:check" onClick={() => { onSave(); onClose(); }}>Save &amp; done</Button>}
          </div>
        </div>
      </div>
    </InkDialog>
  );
}
