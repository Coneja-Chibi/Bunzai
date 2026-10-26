/**
 * The settings under the Story Director row (RoleCall's StagecraftExtensions.tsx:1126-1196, the `ml-5 border-l pl-3` block): Personality, the model and its Reasoning, the command mode, then the
 * runtime box (auto-update.tsx and director-runtime.tsx): the automatic tracker update switch with its list, DM Temperature, Creativity, "Auto-retry invalid tool responses" and "Custom Instructions for DM". Only controls that do something are drawn. RoleCall's "Interactive choices" does nothing for the Director in RoleCall, so it is not here. Every write is
 * the scene's own setting (ChatStore rule 47) and comes back as the panel, so what is shown is what is saved. The Orison, Interpreter, Storyboards and Legacy Trackers parts of RoleCall's block
 * are other props. Whether the Director is on is the row's switch; nothing here repeats it.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { DIRECTOR_CREATIVITY, DIRECTOR_INSTRUCTIONS_MAX, type DirectorCreativity } from "../../../../../stage/contracts/director-types";
import { Button, Segmented } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { DirectorCommandMode, DirectorModel, DirectorReasoning } from "./director-model";
import { AutoUpdate } from "./auto-update";
import { AutoRetryRow, RuntimeNumbers } from "./director-runtime";
import { PersonalityPicker } from "./personality-picker";
import { useDirectorPanel } from "./use-director-panel";

const CREATIVITY_LABEL: Readonly<Record<DirectorCreativity, string>> = { subtle: "Subtle", moderate: "Moderate", dramatic: "Dramatic" };

export function DirectorSettings({ ctx, chat, onChat }: { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void }): JSX.Element {
  const data = useDirectorPanel(ctx, chat);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  if (data.load.state === "loading") return <div className="ds" data-part="props.story-director.settings"><p className="ds-help" role="status">Loading...</p></div>;
  if (data.load.state === "failed") {
    return <div className="ds" data-part="props.story-director.settings"><p className="ds-err" role="alert">{data.load.why}</p><div className="ds-quiet"><Button variant="quiet" size="sm" onClick={data.reload}>Try again</Button></div></div>;
  }
  const { panel } = data.load;
  const s = panel.settings;
  const save = async (patch: Parameters<typeof data.settings>[0]): Promise<string | null> => {
    const why = await data.settings(patch);
    setError(why);
    return why;
  };
  return (
    <div className="ds" data-part="props.story-director.settings">
      <PersonalityPicker value={s.personality} onPick={(personality) => void save({ personality })} />
      <DirectorModel ctx={ctx} chat={chat} panel={panel} save={save} label="Story Director Model" description="AI model for narrative direction." />
      <DirectorReasoning panel={panel} save={save} />
      <DirectorCommandMode panel={panel} save={save} />
      <div className="ds-runtime" data-part="props.story-director.runtime">
        <AutoUpdate ctx={ctx} chat={chat} panel={panel} save={save} {...(onChat ? { onChat } : {})} />
        <RuntimeNumbers panel={panel} save={save} />
        <div className="ds-row" title="How boldly the Director steers the story.">
          <span><Ic name="lucide:wand-sparkles" size={12} />Creativity</span>
          <Segmented size="sm" label="Creativity" items={DIRECTOR_CREATIVITY.map((c) => ({ value: c, label: CREATIVITY_LABEL[c] }))} value={s.creativity} onChange={(c) => void save({ creativity: c })} />
        </div>
        <AutoRetryRow panel={panel} save={save} />
        <div className="ds-instr">
          <label htmlFor="ds-instr-text"><Ic name="lucide:pencil" size={12} />Custom Instructions for DM</label>
          <textarea id="ds-instr-text" rows={3} maxLength={DIRECTOR_INSTRUCTIONS_MAX} value={draft ?? s.instructions}
            placeholder="Tell the Director what to do or avoid (applied every turn). e.g. 'Keep the tone warm and grounded; no sudden villains or outside observers; let scenes breathe.'"
            onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== null && draft !== s.instructions) void save({ instructions: draft === "" ? null : draft }).then((why) => { if (!why) setDraft(null); }); else setDraft(null); }} />
          <p><span>Persistent, unlike the in-the-moment steering note.</span><span>{(draft ?? s.instructions).length}/{DIRECTOR_INSTRUCTIONS_MAX}</span></p>
        </div>
      </div>
      {error && <p className="ds-err" role="alert">{error}</p>}
    </div>
  );
}
