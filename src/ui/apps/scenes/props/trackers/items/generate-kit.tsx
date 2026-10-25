/**
 * Add and Refresh by the scene's model, the way every item tracker offers them (RoleCall's "Add Item" form: a name, "Guide the AI...", Generate; and each
 * expanded card's Refresh: "Guide the AI... (optional)", Generate). RoleCall applies the answer the moment it arrives and, on a bad one, files a made-up item
 * as if it had worked. Here the answer is a PROPOSAL: the item is drawn under the form, and nothing is kept until the person presses Accept. A failed or
 * unreadable answer is said in words and leaves the tracker as it was.
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import type { TrackerModule } from "../../../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { Ic } from "../../../../../_shared/ic";
import type { AppContext } from "../../../../../app-contract";

type Phase<T> = { at: "idle" } | { at: "working" } | { at: "ready"; item: T } | { at: "failed"; error: string };

export interface ItemAsk { module: TrackerModule; variant?: string }

/** One proposal at a time: ask, wait, hold the answer, abandon it. Leaving the panel abandons a pending ask. */
export function useProposal<T>(ctx: AppContext, chatId: string, ask: ItemAsk) {
  const [phase, setPhase] = useState<Phase<T>>({ at: "idle" });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const run = (action: "generate" | "refresh", fields: { itemName?: string; userGuide?: string; existing?: unknown }): void => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ at: "working" });
    ctx.api.proposeTrackerItem({ chatId, module: ask.module, ...(ask.variant ? { variant: ask.variant } : {}), action, ...fields }, controller.signal).then(
      (got) => { if (!controller.signal.aborted) setPhase({ at: "ready", item: got.item as T }); },
      (e: unknown) => { if (!controller.signal.aborted) setPhase({ at: "failed", error: toErrorMessage(e, "the model could not make that") }); },
    );
  };
  const clear = (): void => { abort.current?.abort(); setPhase({ at: "idle" }); };
  return { phase, run, clear };
}

/** The proposed item, with Accept and Discard under it, or the reason it could not be made. */
function Proposal<T>({ phase, noun, preview, accept, again, discard }: { phase: Phase<T>; noun: string; preview(item: T): ReactNode; accept(item: T): void; again(): void; discard(): void }): JSX.Element | null {
  if (phase.at === "failed") return <p className="it-error" role="alert">{phase.error}</p>;
  if (phase.at !== "ready") return null;
  return (
    <div className="it-proposal" role="group" aria-label={`Proposed ${noun}`}>
      <div className="it-proposal-head">Proposed {noun}</div>
      {preview(phase.item)}
      <div className="it-buttons">
        <button type="button" className="it-go" onClick={() => accept(phase.item)}><Ic name="lucide:check" size={12} /> Accept</button>
        <button type="button" className="it-cancel" onClick={again}>Try again</button>
        <button type="button" className="it-cancel" onClick={discard}>Discard</button>
      </div>
    </div>
  );
}

function GenerateButton({ working, disabled, onClick }: { working: boolean; disabled: boolean; onClick(): void }): JSX.Element {
  return (
    <button type="button" className="it-go" disabled={disabled || working} onClick={onClick}>
      {working ? <><span className="it-spin"><Ic name="lucide:loader-circle" size={12} /></span><span>Generating...</span></> : <><Ic name="lucide:sparkles" size={12} /><span>Generate</span></>}
    </button>
  );
}

export interface AddProps<T> {
  ctx: AppContext;
  chatId: string;
  ask: ItemAsk;
  /** "Add Item", "Add Member": the dashed button's words. */
  label: string;
  /** What the proposal is called. */
  noun: string;
  namePlaceholder: string;
  guidePlaceholder: string;
  /** Words over the two boxes, for a form that labels them (the Corruption NPC form). */
  labels?: { name: string; guide: string };
  preview(item: T): ReactNode;
  accept(item: T, name: string): void;
}

/** RoleCall's "Add ..." form: a dashed button that opens a name and a guide, then Generate. */
export function AddByModel<T>({ ctx, chatId, ask, label, noun, namePlaceholder, guidePlaceholder, labels, preview, accept }: AddProps<T>): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [guide, setGuide] = useState("");
  const { phase, run, clear } = useProposal<T>(ctx, chatId, ask);
  const generate = (): void => { if (name.trim()) run("generate", { itemName: name.trim(), ...(guide.trim() ? { userGuide: guide.trim() } : {}) }); };
  const close = (): void => { clear(); setOpen(false); setName(""); setGuide(""); };
  if (!open) return <button type="button" className="it-add" onClick={() => setOpen(true)}><Ic name="lucide:plus" size={14} /><span>{label}</span></button>;
  return (
    <div className="it-form">
      {labels && <label className="it-label" htmlFor="it-add-name">{labels.name}</label>}
      <input id="it-add-name" type="text" placeholder={namePlaceholder} value={name} aria-label={namePlaceholder} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") generate(); }} />
      {labels && <label className="it-label" htmlFor="it-add-guide">{labels.guide}</label>}
      <input id="it-add-guide" type="text" placeholder={guidePlaceholder} value={guide} aria-label="Guide the AI" onChange={(e) => setGuide(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") generate(); }} />
      <div className="it-buttons">
        <GenerateButton working={phase.at === "working"} disabled={!name.trim()} onClick={generate} />
        <button type="button" className="it-cancel" onClick={close}>Cancel</button>
      </div>
      <Proposal phase={phase} noun={noun} preview={preview} again={generate} discard={clear} accept={(item) => { accept(item, name.trim()); close(); }} />
    </div>
  );
}

export interface RefreshProps<T> {
  ctx: AppContext;
  chatId: string;
  ask: ItemAsk;
  noun: string;
  /** The item as it is now. */
  existing: unknown;
  preview(item: T): ReactNode;
  accept(item: T): void;
  /** The card's other action buttons, beside Refresh (Delete, Equip). */
  extra?: ReactNode;
  /** RoleCall's Events card keeps the guide box on show beside an icon button, where the others open it from a Refresh button. */
  inline?: boolean;
}

/** RoleCall's expanded-card Refresh: a button that opens an optional guide, then Generate. */
export function RefreshByModel<T>({ ctx, chatId, ask, noun, existing, preview, accept, extra, inline }: RefreshProps<T>): JSX.Element {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState("");
  const { phase, run, clear } = useProposal<T>(ctx, chatId, ask);
  const generate = (): void => run("refresh", { existing, ...(guide.trim() ? { userGuide: guide.trim() } : {}) });
  const close = (): void => { clear(); setOpen(false); setGuide(""); };
  if (inline) {
    return (
      <>
        <div className="it-actions">
          <input type="text" className="it-grow" placeholder="Guide the AI..." value={guide} aria-label="Guide the AI" disabled={phase.at === "working"} onChange={(e) => setGuide(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") generate(); }} />
          <button type="button" className="it-act" title="Refresh with AI" aria-label="Refresh with AI" disabled={phase.at === "working"} onClick={generate}><span className={phase.at === "working" ? "it-spin" : ""}><Ic name="lucide:refresh-cw" size={14} /></span></button>
          {extra}
        </div>
        <Proposal phase={phase} noun={noun} preview={preview} again={generate} discard={clear} accept={(item) => { accept(item); close(); }} />
      </>
    );
  }
  return (
    <>
      <div className="it-actions">
        <button type="button" className="it-act" title="Refresh with AI" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
          <span className={phase.at === "working" ? "it-spin" : ""}><Ic name="lucide:refresh-cw" size={14} /></span><span>Refresh</span>
        </button>
        {extra}
      </div>
      {open && (
        <div className="it-refresh">
          <input type="text" placeholder="Guide the AI... (optional)" value={guide} aria-label="Guide the AI" onChange={(e) => setGuide(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") generate(); }} />
          <div className="it-buttons">
            <GenerateButton working={phase.at === "working"} disabled={false} onClick={generate} />
            <button type="button" className="it-cancel" onClick={close}>Cancel</button>
          </div>
          <Proposal phase={phase} noun={noun} preview={preview} again={generate} discard={clear} accept={(item) => { accept(item); close(); }} />
        </div>
      )}
    </>
  );
}
