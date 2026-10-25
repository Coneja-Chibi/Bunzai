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
import { Ic } from "../../_shared/ic";
import { InkDialog } from "../../components/ink-dialog";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import { ToggleSwitch } from "../../components/toggle-switch";

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
          {group.suggestions.map((s) => <button type="button" key={s} className={`ch-chip${draft.trim() === s ? " on" : ""}`} onClick={() => { type(s); saver.flush(); }}>{s}</button>)}
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

function PeekButton({ open, onToggle, className }: { open: boolean; onToggle(): void; className?: string }): JSX.Element {
  return (
    <button type="button" className={`ch-eye${open ? " on" : ""}${className ? ` ${className}` : ""}`} aria-label={open ? "Hide prompt" : "View prompt"} aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }}><Ic name="lucide:eye" size={14} /></button>
  );
}

function GroupReadme({ readme }: { readme: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="ch-more">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Read less" : "Read more"}</button>
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
          <ToggleSwitch on={on} className="ch-toggle" onChange={(next) => onSelect(group.id, next)}><span>{on ? "Enabled" : "Disabled"}</span></ToggleSwitch>
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
            <div key={o.id} className="ch-optwrap">
              <button type="button" role={many ? "checkbox" : "radio"} aria-checked={picked} className={`ch-opt${picked ? " on" : ""}${has ? " eye" : ""}`}
                onClick={() => {
                  if (many) { const cur = new Set(strArray(selections[group.id])); if (!cur.delete(o.id)) cur.add(o.id); onSelect(group.id, [...cur]); return; }
                  onSelect(group.id, o.id);
                  if (advance.current) clearTimeout(advance.current);
                  advance.current = setTimeout(() => goTo(index + 1), ADVANCE_MS);
                }}>
                <span className="ch-optrow"><i className={`ch-box${many ? "" : " round"}${picked ? " on" : ""}`}>{picked && <Ic name="lucide:check" size={10} />}</i><b>{o.label}</b></span>
                {o.description && <small>{o.description}</small>}
              </button>
              {has && <PeekButton open={openPeeks.has(key)} onToggle={() => peek(key)} className="corner" />}
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
          <button type="button" className="ch-x" aria-label="Close walkthrough" onClick={onClose}><Ic name="lucide:x" size={14} /></button>
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
                    <button type="button" onClick={() => goTo(steps.findIndex((s) => s.kind === "group" && s.group.id === row.groupId))}>Change</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ch-foot">
          <div className="ch-left">
            <button type="button" className="ch-btn" disabled={index === 0} onClick={() => goTo(index - 1)}><Ic name="lucide:chevron-left" size={14} /> Back</button>
            {step.kind !== "summary" && <button type="button" className="ch-skip" onClick={onClose}>Skip - keep defaults</button>}
          </div>
          <div className="ch-right">
            {blocked && step.kind === "group" && <span className="ch-need">pick at least {step.group.min ?? shortfall}</span>}
            {step.kind !== "summary"
              ? <button type="button" className="ch-btn solid" disabled={blocked} onClick={() => goTo(index + 1)}>Next <Ic name="lucide:chevron-right" size={14} /></button>
              : <button type="button" className="ch-btn solid" onClick={() => { onSave(); onClose(); }}><Ic name="lucide:check" size={14} /> Save &amp; done</button>}
          </div>
        </div>
      </div>
    </InkDialog>
  );
}
