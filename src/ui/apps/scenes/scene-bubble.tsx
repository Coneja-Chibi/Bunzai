/**
 * One message as RoleCall draws it (approved wireframes rc-port/chat.html and scene-turn.html): the
 * portrait, the number, the speaker, the bubble, and its action bar on hover. A reply being written
 * glows with a caret and has no actions; a take that ends on your message offers Ask again; every saved
 * message carries a meta row under it (time; for a reply the model, how long, the finish reason; and the
 * version counter on a reply with several versions or the last one: rc-port/scene-meta.html; RoleCall's chrome prints the time at the foot of the portrait, as its ImmersiveMessage does, and every other theme keeps it in the meta row; a portrait with art enlarges on click: scene-portrait-zoom.tsx); Copy says
 * copied or failed for a moment (_shared/use-copy-feedback.ts); the edit box takes Esc and Ctrl+Enter
 * (scene-edit-box.tsx); the last reply carries Regenerate. Edit and Copy, then RoleCall's eye: Hide from AI / Show to AI
 * (a hidden bubble dims to 30% and carries an amber "Hidden from AI" line); More holds Branch from here
 * (RoleCall's MessageActionOverflow, never on the first message; the bar's groups are Edit and Copy, the generate buttons, then Hide, Final Cut and More, then Delete, divided by hairlines as in ImmersiveMessage.tsx:1197-1455), on an earlier reply Retake from here
 * (a fork, then a fresh reply) and, once a version was edited, Undo last edit and Edit history
 * (scene-history.tsx; rc-port/scene-history.html); the trash button opens the delete
 * menu (scene-cuts.tsx). The opening message before the first send gets Edit too (use-greeting-draft.ts). Text is rendered as text, never as HTML (prose.tsx).
 *
 * Memoized: every action prop is `id`-parameterized so ScenePage can hand
 * every bubble the *same* stable function reference (read from a ref, never a fresh closure per row).
 * With `text`, `menu` and `editing` staying referentially stable across a keystroke or a streamed
 * chunk elsewhere on the page, React's shallow prop compare skips a finished bubble entirely.
 */
import { memo, type CSSProperties, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import { DeleteMenu, type CutScope } from "./scene-cuts";
import type { Speaker } from "../../../core/participants/roster";
import { Prose } from "./prose";
import { MetaRow } from "./scene-meta";
import { EditBox } from "./scene-edit-box";
import { useCopyFeedback } from "../../_shared/use-copy-feedback";
import { useTouchActions } from "./use-touch-actions";
import { HistoryList, type HistoryView } from "./scene-history";
import { ReasoningBlocks } from "./scene-reasoning-blocks";
import type { ReasoningProps } from "./scene-reasoning-core";
import { badgeLabel } from "../../../core/final-cut/trace";
import { uniqueRange, type TextRange } from "../../../core/draft-prompts";
import { WRITING_TOOLS, type ToolId } from "./writing-tools-core";

const tool = (id: ToolId): string => WRITING_TOOLS.find((t) => t.id === id)!.label;
const GUIDED = tool("guided");

/** The passage highlighted inside this message, when it is one place in it (RoleCall hands Correct the selection). */
const highlighted = (text: string): TextRange | null => {
  const picked = typeof window === "undefined" ? "" : window.getSelection()?.toString() ?? "";
  return picked.trim() ? uniqueRange(text, picked) : null;
};

export interface BubbleProps extends ReasoningProps {
  id: string;
  n: number;
  user?: boolean;
  who: string;
  tone: CSSProperties;
  art: JSX.Element;
  text: string;
  editing?: string | undefined;
  /** Which of this bubble's menus is open. */
  menu?: "more" | "delete" | "history" | null;
  onMenu?(id: string, menu: "more" | "delete" | "history" | null): void;
  onEdit?(id: string): void;
  onEditChange?(id: string, text: string): void;
  onEditSave?(id: string): void;
  onEditCancel?(): void;
  onCopy(text: string): Promise<boolean>;
  /** What Copy copies when it is not the text drawn: the message before a scene regex set dressed it. */
  copyText?: string;
  onBranch?(id: string, skipDialog: boolean): void;
  /** An earlier reply: fork at the message it answers, then write a fresh reply there (Retake from here). */
  onRetake?(id: string, skipDialog: boolean): void;
  onCut?(id: string, scope: CutScope, skipConfirm: boolean): void;
  /** How many earlier texts the shown version has; unknown (undefined) until More has read them. */
  historyCount?: number | undefined;
  /** The version's texts, for the Edit history popover. */
  history?: HistoryView | undefined;
  onUndoEdit?(id: string): void;
  onHistory?(id: string): void;
  /** More's Writing tools > Guided re-roll on a reply; `guidance` is the shown version's own instruction, which makes the item "Edit guided re-roll" and hands it back. */
  onGuided?(id: string, previous?: string): void;
  /** More's Writing tools > Expand as character (a reply only): opens the composer in expand mode; it uses no message text. */
  onExpand?(): void;
  /** More's Writing tools > Correct: opens Correction Tools on this message, on the passage highlighted in it if any. */
  onCorrect?(id: string, selection: TextRange | null): void;
  /** What Final Cut did to this reply (the generation's summary), drawn as a scissors button that opens the activity. */
  finalCut?: { passes: number; changed: boolean; failed: number };
  onFinalCut?(id: string): void;
  guidance?: string | undefined;
  /** More's "Remove version N of M" (rule 32); disabled while only one version is left or a reply runs. */
  onRemoveVersion?(id: string): void;
  onRestore?(id: string, index: number): void;
  /** Hidden from the prompt (RoleCall's is_hidden): the bubble dims and says so; the action bar toggles it. */
  hidden?: boolean;
  onHide?(id: string): void;
  /** A reply's speakers, when the Dialogue Colors prop is on: each quote takes its speaker's colour. Keep it identical between renders. */
  speakers?: readonly Speaker[] | undefined;
  /** The text is still arriving: glow, caret, no actions. */
  live?: boolean;
  /** The take's last reply: its meta row always shows. */
  last?: boolean;
  /** Regenerate as a new version; disabled while a reply runs. */
  onRegenerate?(): void;
  /** The take ends on this user message: ask for a reply to it. */
  onAskAgain?(): void;
  /** The last reply: write more on the end of it (RoleCall's Continue, turn-loop rule 13). */
  onContinue?(): void;
  busy?: boolean;
  /** Under the bubble, above the meta row: the cut-off line. */
  footer?: JSX.Element | null;
  /** The meta row's facts: plain strings and numbers, so a finished bubble's props stay referentially stable. */
  stamp?: string | undefined;
  model?: string | undefined;
  genTime?: string | undefined;
  finish?: string | undefined;
  /** The version counter (a reply with several versions, or the last reply): the shown index and the count. */
  vIndex?: number | undefined;
  vCount?: number | undefined;
  vNew?: boolean | undefined;
  vBusy?: boolean | undefined;
  /** Browse to a version of this message. */
  onVersion?(id: string, index: number): void;
  /** Open Compare versions for this message (more than one saved version). */
  onCompare?(id: string): void;
}

function BubbleImpl(p: BubbleProps): JSX.Element {
  const [copied, copy] = useCopyFeedback(p.copyText ?? p.text, p.onCopy);
  const [tapped, onTap] = useTouchActions();
  const copyLabel = copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy";
  const toggle = (menu: "more" | "delete" | "history"): void => p.onMenu?.(p.id, p.menu === menu ? null : menu);
  /** A finished reply with thinking and no text of its own: say so rather than draw an empty bubble. */
  const noReply = !p.live && !p.text.trim() && Boolean(p.rNat || p.rTag);
  return (
    <div className={`msg ${p.user ? "user" : "char"}${p.last ? " last" : ""}${p.hidden ? " hid" : ""}${tapped ? " tap" : ""}`} data-part="scene.message" data-mid={p.id} style={p.tone} onClick={onTap}>
      <div className="pw">{p.art}{p.stamp && <span className="pstamp">{p.stamp}</span>}</div>
      <div className="body">
        <div className="bnum"><span className="badge" title={`Post #${p.n}`}>#{p.n}</span></div>
        <div className="spk">{p.who}</div>{p.stamp && <span className="spk-time" hidden>{p.stamp}</span>}
        <ReasoningBlocks {...p} only={noReply} onCopy={p.onCopy} />
        <div className={`bub${p.live ? " live" : ""}`}>
          {p.live ? (
            <><Prose text={p.text} speakers={p.speakers} /><span className="caret" aria-hidden="true" /></>
          ) : p.editing !== undefined ? (
            <>
              <EditBox value={p.editing} onChange={(t) => p.onEditChange?.(p.id, t)} onSave={() => p.onEditSave?.(p.id)} onCancel={() => p.onEditCancel?.()} />
              <div className="editrow"><button type="button" onClick={p.onEditCancel}>Cancel</button><button type="button" className="save" onClick={() => p.onEditSave?.(p.id)}>Save</button></div>
            </>
          ) : (
            <>
              {noReply ? <p className="noreply">No reply text. The model returned only its thinking{p.finish === "length" ? ", and stopped at the token limit" : ""}.</p> : <Prose text={p.text} speakers={p.speakers} />}
              <div className={`acts${p.menu ? " held" : ""}`}>
                {p.onEdit && <button type="button" className="edit" title="Edit" aria-label="Edit" onClick={() => p.onEdit?.(p.id)}><Ic name="lucide:pen-line" /></button>}
                <button type="button" className="lucide:copy" data-state={copied ?? undefined} title={copyLabel} aria-label={copyLabel} onClick={copy}><Ic name={copied === "copied" ? "lucide:check" : copied === "failed" ? "lucide:x" : "lucide:copy"} /></button>
                {(p.onRegenerate || p.onContinue || p.onAskAgain) && <span className="sep" aria-hidden="true" />}
                {p.onRegenerate && <button type="button" className="gen" title="Regenerate as a new version" aria-label="Regenerate as a new version" disabled={p.busy} onClick={p.onRegenerate}><Ic name="lucide:rotate-ccw" /></button>}
                {p.onContinue && <button type="button" className="gen cont" title="Continue generation" aria-label="Continue generation" disabled={p.busy} onClick={p.onContinue}><Ic name="lucide:play" /></button>}
                {p.onAskAgain && <button type="button" className="gen" title="Ask again for a reply" aria-label="Ask again for a reply" disabled={p.busy} onClick={p.onAskAgain}><Ic name="lucide:rotate-ccw" /></button>}
                {(p.onHide || p.finalCut || p.onBranch || p.onRetake || p.onUndoEdit || p.onGuided || p.onExpand || p.onCorrect || p.onRemoveVersion) && <span className="sep" aria-hidden="true" />}
                {p.onHide && (
                  <button type="button" className={`hide${p.hidden ? " on" : ""}`} title={p.hidden ? "Show to AI (currently hidden)" : "Hide from AI"} aria-label={p.hidden ? "Show to AI (currently hidden)" : "Hide from AI"} aria-pressed={p.hidden === true} onClick={() => p.onHide?.(p.id)}><Ic name={p.hidden ? "lucide:eye-off" : "lucide:eye"} /></button>
                )}
                {p.finalCut && p.onFinalCut && <button type="button" className={`fcut${p.finalCut.failed > 0 ? " bad" : ""}`} title={badgeLabel(p.finalCut)} aria-label={badgeLabel(p.finalCut)} onClick={() => p.onFinalCut?.(p.id)}><Ic name="lucide:scissors" /></button>}
                {(p.onBranch || p.onRetake || p.onUndoEdit || p.onGuided || p.onExpand || p.onCorrect || p.onRemoveVersion) && (
                  <span className="hold">
                    <button type="button" title="More message actions" aria-label="More message actions" aria-expanded={p.menu === "more" || p.menu === "history"} className={p.menu === "more" || p.menu === "history" ? "on" : undefined} onClick={() => toggle("more")}><Ic name="lucide:ellipsis" /></button>
                    {p.menu === "more" && (
                      <div className="menu" role="menu">
                        {p.onUndoEdit && (
                          <>
                            <button type="button" role="menuitem" disabled={!p.historyCount} onClick={() => p.onUndoEdit?.(p.id)}><Ic name="lucide:rotate-ccw" size={14} />Undo last edit</button>
                            <button type="button" role="menuitem" disabled={!p.historyCount} onClick={() => p.onHistory?.(p.id)}><Ic name="lucide:history" size={14} />Edit history{p.historyCount ? <span className="ct">{p.historyCount}</span> : null}</button>
                          </>
                        )}
                        {p.onBranch && <button type="button" role="menuitem" onClick={(e) => p.onBranch?.(p.id, e.shiftKey)}><Ic name="lucide:git-branch" size={14} />Branch from here</button>}
                        {p.onRetake && <button type="button" role="menuitem" onClick={(e) => p.onRetake?.(p.id, e.shiftKey)}><Ic name="lucide:rotate-ccw" size={14} />Retake from here</button>}
                        {(p.onGuided || p.onExpand || p.onCorrect) && (
                          <>
                            <hr className="menu-rule" />
                            <div className="sec">Writing tools</div>
                            {p.onGuided && <button type="button" role="menuitem" disabled={p.busy === true} onClick={() => p.onGuided?.(p.id, p.guidance)}><Ic name="lucide:sparkles" size={14} />{p.guidance ? `Edit ${GUIDED.toLowerCase()}` : GUIDED}</button>}
                            {p.onCorrect && <button type="button" role="menuitem" onClick={() => p.onCorrect?.(p.id, highlighted(p.text))}><Ic name="lucide:wand-sparkles" size={14} />{tool("correct")}</button>}
                            {p.onExpand && <button type="button" role="menuitem" onClick={() => p.onExpand?.()}><Ic name="lucide:user" size={14} />{tool("expand-character")}</button>}
                          </>
                        )}
                        {p.onRemoveVersion && (
                          <>
                            <hr className="menu-rule" />
                            <button type="button" role="menuitem" className="danger" disabled={p.busy === true || !p.vCount || p.vCount < 2 || p.vIndex === undefined} title={p.vCount && p.vCount > 1 ? undefined : "A reply keeps at least one version"} onClick={() => p.onRemoveVersion?.(p.id)}>
                              <Ic name="lucide:rotate-ccw" size={14} />{p.vCount && p.vCount > 1 && p.vIndex !== undefined ? `Remove version ${p.vIndex + 1} of ${p.vCount}` : "Remove this version"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {p.menu === "history" && p.history && <HistoryList history={p.history} onRestore={(i) => p.onRestore?.(p.id, i)} />}
                  </span>
                )}
                {p.onCut && <span className="sep" aria-hidden="true" />}
                {p.onCut && (
                  <span className="hold">
                    <button type="button" title="Delete" aria-label="Delete" aria-expanded={p.menu === "delete"} className={`del${p.menu === "delete" ? " on" : ""}`} onClick={() => toggle("delete")}><Ic name="lucide:trash-2" /></button>
                    {p.menu === "delete" && <DeleteMenu onPick={(scope, skip) => p.onCut?.(p.id, scope, skip)} />}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {p.hidden && <span className="hidtag" title="Hidden from AI context">Hidden from AI</span>}
        {p.footer}
        {!p.live && p.editing === undefined && (
          <MetaRow stamp={p.stamp} model={p.model} genTime={p.genTime} finish={p.finish}
            versions={p.vIndex !== undefined && p.vCount !== undefined && p.onVersion ? {
              index: p.vIndex, count: p.vCount, isNew: p.vNew === true, busy: p.vBusy === true,
              onPrev: () => p.onVersion?.(p.id, p.vIndex! - 1),
              onNext: () => p.onVersion?.(p.id, p.vIndex! + 1),
              onGo: (i) => p.onVersion?.(p.id, i),
              ...(p.onCompare ? { onCompare: () => p.onCompare?.(p.id) } : {}),
              ...(p.onRegenerate ? { onRegenerate: p.onRegenerate } : {}),
            } : undefined} />
        )}
      </div>
    </div>
  );
}

export const Bubble = memo(BubbleImpl);
