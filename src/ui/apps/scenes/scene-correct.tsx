/**
 * Correction Tools, as RoleCall's modal draws it (CorrectionToolsPanel.tsx): Spellcheck, Corrections and Rewrite
 * over one message. Each tool asks the scene's model through `runSceneDraft` and shows a side-by-side preview;
 * Apply hands the revised text to `onApply`, which edits the shown version in place (see use-scene-correct.ts).
 * Nothing is applied until the person says so, and a tool that fails says why and leaves the message alone.
 */
import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from "react";
import { CUSTOM_INSTRUCTION_MAX, textRange, type RewriteAction, type TextRange } from "../../../core/draft-prompts";
import type { GuideRecord } from "../../../core/guide-record";
import type { ScenesApi } from "../../app-contract-scenes";
import { toErrorMessage } from "../../_shared/error-message";
import { Button, IconButton, ListRow, Tabs } from "../../components/button";
import { InkDialog } from "../../components/ink-dialog";
import { CORRECT_TABS, REWRITE_BUTTONS, applied, correctionGuides, selectionPreview, type CorrectTab, type Preview } from "./correct-core";

/** Original beside Corrected (or Polished); a Rewrite adds the Selected / Replacement pair and the Revised Message. */
function PreviewPane({ preview, tail, onCancel, onApply, busy }: { preview: Preview; tail: string; onCancel(): void; onApply(): void; busy: boolean }): JSX.Element {
  const rewrite = preview.kind === "rewrite";
  return (
    <div className="cx-prev">
      {rewrite && (
        <div className="cx-cols">
          <section><h4>Selected</h4><pre>{preview.selected}</pre></section>
          <section><h4>Replacement</h4><pre>{preview.replacement || "(deleted)"}</pre></section>
        </div>
      )}
      <div className="cx-cols">
        {!rewrite && <section><h4>Original</h4><pre>{preview.original}</pre></section>}
        <section className="new"><h4>{rewrite ? "Revised Message" : tail}</h4><pre>{preview.corrected}</pre></section>
      </div>
      <div className="cx-acts">
        <Button variant="quiet" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant="primary" icon="lucide:check" onClick={onApply} disabled={busy}>Apply</Button>
      </div>
    </div>
  );
}

export function CorrectionTools({ api, chatId, message, selection, onApply, onClose }: {
  api: Pick<ScenesApi, "runSceneDraft" | "listGuides">;
  chatId: string;
  /** The text of the version being corrected. */
  message: string;
  /** A passage the person had highlighted when they opened the tool: the Rewrite tab opens on it. */
  selection?: TextRange | null;
  /** Writes the revised text over the version; rejects when it could not. */
  onApply(text: string): Promise<void>;
  onClose(): void;
}): JSX.Element {
  const [tab, setTab] = useState<CorrectTab>(selection ? "rewrite" : "spellcheck");
  const [guides, setGuides] = useState<GuideRecord[] | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TextRange | null>(selection ?? null);
  const [instruction, setInstruction] = useState("");
  const area = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    let alive = true;
    api.listGuides().then((all) => alive && setGuides(correctionGuides(all)), () => alive && setGuides([]));
    return () => { alive = false; };
  }, [api]);

  const pick = (next: CorrectTab): void => { setTab(next); setPreview(null); setError(null); };
  const ask = async (key: string, run: () => Promise<Preview>): Promise<void> => {
    setWorking(key);
    setError(null);
    try {
      setPreview(await run());
    } catch (e) {
      setError(toErrorMessage(e, "That did not work"));
    } finally {
      setWorking(null);
    }
  };
  const spellcheck = () => ask("spellcheck", async () => ({ kind: "spellcheck", original: message, corrected: (await api.runSceneDraft({ chatId, kind: "spellcheck", text: message })).text }));
  const correct = () => ask("correct", async () => ({ kind: "corrections", original: message, corrected: (await api.runSceneDraft({ chatId, kind: "correct", text: message, guideId: guideId! })).text }));
  const rewrite = (action: "delete" | RewriteAction): Promise<void> => {
    if (!range) { setError("Highlight text in the message first"); return Promise.resolve(); }
    if (action === "delete") { setError(null); setPreview(selectionPreview(message, range, "")); return Promise.resolve(); }
    return ask(action, async () => selectionPreview(message, range, (await api.runSceneDraft({ chatId, kind: "rewrite", text: message, selected: range.text, action, ...(action === "custom" ? { instruction: instruction.trim() } : {}) })).text));
  };
  const apply = async (): Promise<void> => {
    if (!preview) return;
    setWorking("apply");
    try {
      await onApply(applied(preview));
      onClose();
    } catch (e) {
      setError(toErrorMessage(e, "The message could not be changed"));
      setWorking(null);
    }
  };
  const track = (e: SyntheticEvent<HTMLTextAreaElement>): void => setRange(textRange(message, e.currentTarget.selectionStart, e.currentTarget.selectionEnd));
  const busy = working !== null;
  const blurb = CORRECT_TABS.find((t) => t.key === tab)!.blurb;
  const review = preview && preview.kind === tab ? <PreviewPane preview={preview} tail={tab === "spellcheck" ? "Polished" : "Corrected"} busy={busy} onCancel={() => setPreview(null)} onApply={() => void apply()} /> : null;

  return (
    <InkDialog onDismiss={onClose} ariaLabel="Correction Tools" sheetClassName="cx-sheet">
      <div className="cx" data-part="scene.correct">
        <header className="cx-top"><h2>Correction Tools</h2><IconButton variant="quiet" size="sm" label="Close correction tools" icon="lucide:x" onClick={onClose} /></header>
        <Tabs label="Correction tools" items={CORRECT_TABS.map((t) => ({ value: t.key, label: t.label }))} value={tab} onChange={pick} />
        <div className="cx-body">
          {error && <p className="cx-err" role="alert">{error}</p>}
          <p className="cx-blurb">{blurb}</p>
          {tab === "spellcheck" && (review ?? <Button variant="primary" block disabled={busy} onClick={() => void spellcheck()}>{working === "spellcheck" ? "Checking..." : "Run Spellcheck"}</Button>)}
          {tab === "corrections" && (guides === null ? <p className="cx-note" role="status">Loading...</p>
            : guides.length === 0 ? <div className="cx-note"><b>No correction guides available</b><small>Create correction guides in the Guides panel</small></div>
            : review ?? (
              <div className="cx-guides">
                {guides.map((g) => (
                  <ListRow key={g.id} wrap variant="option" selected={guideId === g.id} aria-pressed={guideId === g.id} onClick={() => setGuideId(g.id)} label={g.title} subtitle={g.content} />
                ))}
                <Button variant="primary" block disabled={!guideId || busy} onClick={() => void correct()}>{working === "correct" ? "Correcting..." : "Apply Correction"}</Button>
              </div>
            ))}
          {tab === "rewrite" && (review ?? (
            <div className="cx-rw">
              <textarea ref={area} readOnly value={message} aria-label="Message" onSelect={track} onMouseUp={track} onKeyUp={track} />
              <div className="cx-sel">
                <span>{range ? `Selected ${range.text.length.toLocaleString()} chars: ${range.text.slice(0, 80)}${range.text.length > 80 ? "..." : ""}` : "No text selected"}</span>
                <Button variant="quiet" size="sm" onClick={() => { setRange(textRange(message, 0, message.length)); area.current?.select(); }}>Select all</Button>
              </div>
              <input className="cx-instr" aria-label="Custom instruction" placeholder="How should this change?" maxLength={CUSTOM_INSTRUCTION_MAX} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              <div className="cx-grid">
                {REWRITE_BUTTONS.map((b) => <Button key={b.action} block disabled={!range || busy || (b.action === "custom" && instruction.trim() === "")} onClick={() => void rewrite(b.action)}>{working === b.action ? "Working..." : b.label}</Button>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </InkDialog>
  );
}
