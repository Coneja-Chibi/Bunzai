/**
 * The Prompting wing's Scene Note tab: RoleCall's AuthorNotePanel on Bunraku. A persistent line of
 * guidance that rides along with the prompt at a position and frequency, kept on the scene (ChatStore rule
 * 37). It saves one second after the last change and when the tab closes, as RoleCall's panel does.
 */
import { useRef, useState, type JSX } from "react";
import { NOTE_DEFAULTS, NOTE_DEPTH_MAX, NOTE_MAX } from "../../../core/assembly/note";
import type { ChatNote } from "../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../_shared/error-message";
import { Ic, type IconName } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import { FREQUENCIES, depthHint, frequencyHint, sameNote } from "./guides-core";

/** How the tab reads in the fold: RoleCall's fixed "ongoing direction". */
export const NOTE_TAB_META = "Ongoing direction";


const POSITIONS: readonly { id: ChatNote["position"]; label: string; text: string; icon: IconName }[] = [
  { id: "after_scenario", label: "After Scenario", text: "Inject at the top of context, after character/preset prompts", icon: "mdi:format-vertical-align-top" },
  { id: "in_chat", label: "In Chat History", text: "Inject between messages at a specific depth", icon: "mdi:message-text-outline" },
];
const TIPS: readonly { label: string; sample: string }[] = [
  { label: "Response Formatting", sample: "[Write 300 words in past tense, third person]" },
  { label: "Situational Context", sample: "[{{char}} is currently in the library, feeling tired]" },
  { label: "Style Guidance", sample: "[Use *italics* for actions, \"quotes\" for speech]" },
  { label: "Reinforcement", sample: "[Remember: stay in character, be descriptive]" },
];

/** What a failed note save says, inline while the tab is open and on the status line after it has closed. */
export const noteSaveFailure = (e: unknown): string => `Couldn't save Scene Note. Your changes are still pending. ${toErrorMessage(e, "")}`.trim();

export function SceneNoteWing({ saved, onSave }: { saved: ChatNote | undefined; onSave(note: ChatNote): Promise<void> }): JSX.Element {
  const [note, setNote] = useState<ChatNote>(saved ?? NOTE_DEFAULTS);
  const [kept, setKept] = useState<ChatNote>(saved ?? NOTE_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tips, setTips] = useState(false);
  const dirty = !sameNote(note, kept);
  const live = useRef({ kept, onSave });
  live.current = { kept, onSave };

  const write = async (next: ChatNote): Promise<void> => {
    // A change put back to what is kept needs no write.
    if (sameNote(next, live.current.kept)) return;
    setSaving(true);
    try {
      await live.current.onSave(next);
      setKept(next);
      setFailed(null);
    } finally {
      setSaving(false);
    }
  };
  // One second after the last change, and when the tab closes with one still waiting.
  const saver = useDebouncedSave<ChatNote>(write, 1000, (e) => setFailed(noteSaveFailure(e)));

  const set = (change: Partial<ChatNote>) => {
    const next = { ...note, ...change };
    setNote(next);
    saver.push(next);
  };
  return (
    <div className="wbody pp pn-note" data-part="scene.prompting.note">
      <div className="pp-top">
        <header className="hero">
          <span className="hi"><Ic name="mdi:note-text-outline" size={20} /></span>
          <div><div className="eb">Persistent prompt guidance</div><h2>Scene <em>Note</em></h2><p>A persistent line of guidance that rides along with every prompt at the position and frequency you choose.</p></div>
        </header>
        {(saving || dirty || failed) && (
          <div className="pg-status" role="status">
            {saving ? <span><Ic name="lucide:loader-circle" size={14} /> Saving</span> : dirty ? <span className="warn">Unsaved</span> : null}
            {failed && <span className="warn">{failed}</span>}
          </div>
        )}
      </div>
      <div className="pg-body">

      <section className="pg-card">
        <div className="pg-label"><span>Note content</span><small>{note.text.length.toLocaleString()} / {NOTE_MAX.toLocaleString()}</small></div>
        <textarea value={note.text} maxLength={NOTE_MAX} rows={6} aria-label="Note content" placeholder="[Write ongoing scene guidance here...]" onChange={(e) => set({ text: e.target.value })} />
        <p className="pg-help">Supports macros: <code>{"{{char}}"}</code>, <code>{"{{user}}"}</code>, <code>{"{{time}}"}</code>, etc.</p>
      </section>

      <section className="pg-card">
        <div className="pg-label"><span>Position</span></div>
        <div className="pg-opts">
          {POSITIONS.map((p) => (
            <button type="button" key={p.id} className={`pg-opt${note.position === p.id ? " on" : ""}`} aria-pressed={note.position === p.id} onClick={() => set({ position: p.id })}>
              <Ic name={p.icon} size={20} /><span><b>{p.label}</b><small>{p.text}</small></span>
            </button>
          ))}
        </div>
      </section>

      {note.position === "in_chat" && (
        <section className="pg-card">
          <div className="pg-label"><Ic name="mdi:layers-outline" size={14} /><span>Injection depth</span></div>
          <div className="pg-depth">
            <Slider readout={false} min={0} max={NOTE_DEPTH_MAX} value={note.depth} aria-label="Injection depth" color="var(--w)" onChange={(depth) => set({ depth })} />
            <b>{note.depth}</b>
          </div>
          <p className="pg-help pg-hint">{depthHint(note.depth)}</p>
        </section>
      )}

      <section className="pg-card">
        <div className="pg-label"><Ic name="mdi:repeat" size={14} /><span>Frequency</span></div>
        <div className="pg-chips">
          {FREQUENCIES.map((f) => (
            <button type="button" key={f.value} className={`pg-chip${note.frequency === f.value ? " on" : ""}`} aria-pressed={note.frequency === f.value} onClick={() => set({ frequency: f.value })}>{f.label}</button>
          ))}
        </div>
        <p className="pg-help pg-hint">{frequencyHint(note.frequency)}</p>
      </section>

      <div>
        <button type="button" className="pg-fold pg-tipsbtn" aria-expanded={tips} onClick={() => setTips(!tips)}><Ic name="lucide:info" size={14} />Tips &amp; Examples <Ic name={tips ? "lucide:chevron-up" : "lucide:chevron-down"} size={14} /></button>
        {tips && (
          <section className="pg-card pg-tips">
            {TIPS.map((t) => <div key={t.label}><b>{t.label}</b><code>{t.sample}</code></div>)}
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
