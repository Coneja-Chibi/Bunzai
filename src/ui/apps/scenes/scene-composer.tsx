/**
 * The scene's composer: the draft, in its own component, so a keystroke calls
 * this component's own `setDraft`, never ScenePage's, and no Bubble re-renders while typing. `onSend`
 * says whether the message went through; the draft clears only then. ArrowUp in an empty draft asks
 * the page to edit the user's last message (RoleCall's useChatKeyboardShortcuts). The unsent draft is
 * kept per scene in the app prefs (RoleCall's useDraftPersistence): saved a second after typing stops
 * and when the scene closes, read back when it opens, emptied when the message goes.
 *
 * Steering (a guided re-roll, RoleCall's steeringMode): the box becomes the instruction for a new version
 * of the last reply. It has its own text, so the unsent draft is kept as it was; Send (a re-roll icon)
 * takes the text, empty meaning a plain re-roll; Esc or Cancel leaves.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import type { AppContext } from "../../app-contract";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { draftKey, readDraft } from "./composer-tools-core";
import type { ScenesApi } from "../../app-contract-scenes";
import { useComposerGrow } from "./composer-grow";
import { ComposerTools, type ComposerToolsProps } from "./scene-composer-tools";
import { DraftStatusStrip } from "./scene-draft-status";
import { useComposerDrafts } from "./use-composer-drafts";
import { publishDraft } from "./context/draft-bus";
import type { Steering } from "./use-scene-composer";

export function SceneComposer({ api, chatId, prefs, persona, expandTick, name, connected, busy, showAiHint, tools, steering, onSteer, onCancelSteer, onStop, onOpenAiWing, onSend, onEditLast }: {
  api: Pick<ScenesApi, "runSceneDraft">;
  chatId: string;
  prefs: AppContext["prefs"];
  /** The player's name, for the draft tools' ribbon. */
  persona: string;
  /** Counts up each time the message menu asks for expand mode. */
  expandTick: number;
  name: string;
  connected: boolean;
  busy: boolean;
  showAiHint: boolean;
  tools: Omit<ComposerToolsProps, "onExpand">;
  steering: Steering | null;
  onSteer(text: string): void;
  onCancelSteer(): void;
  onStop(): void;
  onOpenAiWing(): void;
  onSend(content: string): Promise<boolean>;
  onEditLast(): boolean;
}): JSX.Element {
  const key = draftKey(chatId);
  const [draft, setDraft] = useState(() => readDraft(prefs.get(key)));
  /** Only a changed draft is written: a save that changes nothing would still rewrite the settings file. */
  const keep = useDebouncedSave<string>((text) => { if (readDraft(prefs.get(key)) !== text) prefs.set(key, text); }, 1000);
  const edit = (text: string): void => { setDraft(text); keep.push(text); publishDraft(chatId, text); };
  const drafts = useComposerDrafts({ api, chatId, text: draft, setText: edit });
  const [steerText, setSteerText] = useState("");
  const [seen, setSeen] = useState(steering);
  // Steering begins afresh each time it is asked for: the box starts with the version's old instruction, or empty.
  if (seen !== steering) { setSeen(steering); setSteerText(steering?.initial ?? ""); }
  const field = useRef<HTMLTextAreaElement>(null);
  useComposerGrow(field, steering ? steerText : draft);
  useEffect(() => { if (steering) field.current?.focus(); }, [steering]);
  // The message menu's Expand as character: the pill strip opens over the box, which takes the outline.
  useEffect(() => { if (expandTick > 0) { drafts.beginExpand(); field.current?.focus(); } }, [expandTick]); // eslint-disable-line react-hooks/exhaustive-deps -- fires on the request alone
  const menu: ComposerToolsProps = {
    ...tools,
    onPick: (id) => { if (id === "polish") { tools.onToggle(); drafts.polish(); } else tools.onPick(id); },
    onExpand: (perspective) => { tools.onToggle(); drafts.expand(perspective); },
  };
  /** A second Enter or click while one send is in flight is dropped, not queued. */
  const sending = useRef(false);
  const submit = async (): Promise<void> => {
    if (steering) { if (!busy) onSteer(steerText.trim()); return; }
    if (busy || sending.current || draft.trim() === "") return;
    sending.current = true;
    try {
      if (await onSend(draft)) { keep.cancel(); setDraft(""); prefs.set(key, ""); publishDraft(chatId, ""); }
    } finally {
      sending.current = false;
    }
  };
  const label = `${name}'s last reply`;
  return (
    <div className="dockbar" data-part="scene.composer">
      <DraftStatusStrip drafts={drafts} persona={persona} />
      {steering && (
        <div className="steer" data-part="scene.composer.steering" role="status">
          <b>Steering {label}</b>
          <span>Your next send becomes the regen instruction. Empty = re-roll without instruction.</span>
          <button type="button" onClick={onCancelSteer}><Ic name="lucide:x" size={14} />Cancel</button>
        </div>
      )}
      <form className={`cap${connected ? "" : " off"}`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <ComposerTools {...menu} />
        <textarea ref={field} rows={1} value={steering ? steerText : draft} aria-label="Message"
          placeholder={steering ? "Tell the AI how to retake the message, or hit send with no text to re-roll without instruction…" : connected ? `Message ${name}...` : "Pick a connection to start the scene."}
          onChange={(e) => (steering ? setSteerText(e.target.value) : edit(e.target.value))}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (steering && isEscapeClose(e.nativeEvent)) { e.preventDefault(); onCancelSteer(); }
            else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
            else if (e.key === "ArrowUp" && draft === "" && !steering && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && onEditLast()) e.preventDefault();
          }} />
        {showAiHint && <button type="button" className="hint" onClick={onOpenAiWing}>Open AI wing</button>}
        {busy
          ? <button type="button" className="stop" aria-label="Stop" title="Stop" onClick={onStop}><Ic name="lucide:square" fill /></button>
          : steering
            ? <button type="submit" className="send" aria-label="Regenerate" title="Regenerate (ESC to cancel)" disabled={!connected}><Ic name="lucide:rotate-ccw" /></button>
            : <button type="submit" className="send" aria-label="Send" disabled={!connected || draft.trim() === ""}><Ic name="lucide:send" /></button>}
      </form>
    </div>
  );
}
