/**
 * The scene scope's Writing page (approved wireframe messenger-discord/settings.html, scene > Prompt > Writing): the preset, the samplers, guides, the scene note, the writing helpers, the regex sets and the Final Cut
 * switches, every stored value as a row bound to the writer Full Chat already uses. The tools themselves (the prompt editor, the guide editor, the regex script editor, each pass's controls) are drill rows that open their own
 * Messenger program through the shell's opener. The prompt switches and the preset's choices are on the Prompt blocks deeper page (prompt-blocks.tsx): the Samplers section holds the one scene preset writer on this page, and a second one here could overwrite its values.
 */
import { useEffect, useReducer, useRef, useState, type JSX } from "react";
import { NOTE_DEFAULTS, NOTE_DEPTH_MAX, NOTE_MAX } from "../../../../../../core/assembly/note";
import type { ChatNote } from "../../../../../../stage/contracts/chat-store";
import type { StudioEntitySummary } from "../../../../../app-contract";
import { usePromptingView } from "../../../generation/use-prompting-view";
import { FREQUENCIES, sameNote } from "../../../guides-core";
import { useBoothPreset } from "../../../use-booth-preset";
import { WRITING_TOOLS } from "../../../writing-tools-core";
import { INSPECTOR_KEY, readInspector } from "../../../inspector-core";
import { presetTabMeta } from "../../../scene-preset-wing";
import { DrillRow, SegmentedRow, SelectRow, ToggleRow } from "../../frames/settings-rows";
import { useSettingsNav, type SettingsCategory } from "../../frames/settings-window";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { CheckedText } from "./drafts";
import { chatOf, sayFailed, sceneEnv, takeChat, type SceneEnv } from "./env";
import { PROMPTS_PAGE } from "./pages";
import { SavedNumber } from "./saved";
import { FinalCutBody, GuidesBody, RegexBody } from "./writing-lists";
import { SamplersBody } from "./writing-samplers";
import { listWritingSetups, setupLabel, setupOf, setupValue } from "../../../../../_shared/writing-setups";

function PresetBody({ env }: { env: SceneEnv }): JSX.Element {
  const chat = chatOf(env);
  const { ctx } = env.a;
  const nav = useSettingsNav();
  const [, again] = useReducer((n: number) => n + 1, 0);
  const preset = useBoothPreset(ctx, chat.preset ?? null);
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  useEffect(() => {
    let live = true;
    listWritingSetups(api.current).then((list) => live && setLibrary(list), () => live && setLibrary([]));
    return () => { live = false; };
  }, []);
  const id = chat.preset ? setupValue(chat.preset) : "";
  const name = !id ? "None chosen" : preset.state === "ready" ? preset.body.name : preset.state === "loading" ? "Loading..." : preset.state === "gone" ? "No longer in your library" : "Could not be read";
  const choices = (library ?? []).map((s) => ({ value: setupValue(s), label: setupLabel(s) }));
  const options = [{ value: "", label: "Run without a preset" }, ...(id && !choices.some((c) => c.value === id) ? [{ value: id, label: name }] : []), ...choices];
  // A new preset starts from its own switches and samplers, as the Preset tab does when it is switched.
  const pick = (next: string): void => { const setup = setupOf(next); void ctx.api.setScenePreset(chat.id, setup ? { ...setup, toggles: {}, samplers: {} } : null).then(takeChat(env), sayFailed(env, "The preset")); };
  return (
    <div data-part="scene.messenger.settings.writing.preset">
      <SelectRow label="Preset" description="How the prompt is built. The new preset's own switches and samplers replace this scene's." value={id} options={options} onChange={pick} />
      <DrillRow label="Prompt blocks" description="Switch each prompt on or off for this scene, and answer the preset's choices." value={id && preset.state === "ready" ? presetTabMeta(chat, preset.body) : undefined} onOpen={() => nav.open(PROMPTS_PAGE)} />
      <DrillRow label="Prompt editor" description="What each prompt says, its order and the preset's templates." onOpen={() => env.open("prompts")} />
      <ToggleRow label="Prompt inspector" description="Pause before each send to read and edit the prompt. The composer's Tools menu has the same switch." on={readInspector(ctx.prefs.get(INSPECTOR_KEY))} onChange={(on) => { ctx.prefs.set(INSPECTOR_KEY, on); again(); }} />
    </div>
  );
}

const POSITIONS = [{ value: "after_scenario", label: "After scenario" }, { value: "in_chat", label: "In chat history" }] as const;

function NoteBody({ env }: { env: SceneEnv }): JSX.Element {
  const { view, write } = usePromptingView(env.a.ctx, chatOf(env), takeChat(env));
  const note = view.note ?? NOTE_DEFAULTS;
  const put = (change: Partial<ChatNote>): void => { const next = { ...note, ...change }; if (!sameNote(next, note)) write({ note: next }, "Scene Note"); };
  return (
    <div data-part="scene.messenger.settings.writing.note">
      <CheckedText label="Note" description="Injected into the prompt, with macros such as {{char}} and {{user}}." saved={note.text} rows={5} delay={1000}
        check={(t) => (t.length > NOTE_MAX ? `Use at most ${NOTE_MAX.toLocaleString()} characters.` : null)} write={(text) => put({ text })} />
      <SegmentedRow label="Position" value={note.position} options={POSITIONS} onChange={(position) => put({ position })} />
      {note.position === "in_chat" && <SavedNumber label="Injection depth" description="Messages from the end of the history. 0 is the very bottom." saved={note.depth} min={0} max={NOTE_DEPTH_MAX} step={1} write={(depth) => put({ depth })} />}
      <SelectRow label="Frequency" description="How often the note rides along." value={String(note.frequency)} options={FREQUENCIES.map((f) => ({ value: String(f.value), label: f.label }))} onChange={(v) => put({ frequency: Number(v) })} />
    </div>
  );
}

function HelperRows({ env }: { env: SceneEnv }): JSX.Element {
  return (
    <div data-part="scene.messenger.settings.writing.helpers">
      {WRITING_TOOLS.filter((t) => t.built).map((t) => (
        <DrillRow key={t.id} label={t.label} description={`${t.description} What it sends, and the prompt it uses.`} {...(t.shortcut ? { value: t.shortcut } : {})} onOpen={() => env.open("writing-tools")} />
      ))}
    </div>
  );
}

/** The Writing category of the scene scope. `open` is the shell's program opener; the category can be given the page's wing arguments and the opener, or both as one environment. */
export function writingCategory(env: SceneEnv): SettingsCategory;
export function writingCategory(a: WingArgs, open: OpenProgram): SettingsCategory;
export function writingCategory(first: SceneEnv | WingArgs, open?: OpenProgram): SettingsCategory {
  // clone-ok: a settings category is a table of sections, the same shape as every other category by design
  const env = sceneEnv(first, open);
  return { id: "writing", label: "Writing", icon: "lucide:pen-line", group: "Prompt", sections: [
    { id: "preset", title: "Presets and prompts", description: "How the prompt is built.", body: <PresetBody env={env} /> },
    { id: "samplers", title: "Samplers", description: "The numbers that shape each reply, and every other parameter the model can be sent.", body: <SamplersBody env={env} /> },
    { id: "guides", title: "Guides", description: "Writing guides, switched on per scene.", body: <GuidesBody env={env} /> },
    { id: "note", title: "Scene note", description: "Guidance that rides along with the prompt.", body: <NoteBody env={env} /> },
    { id: "helpers", title: "Writing helpers", description: "Tools that draft and fix text.", body: <HelperRows env={env} /> },
    { id: "regex", title: "Regex workshop", description: "Pattern scripts that rewrite messages, switched on per scene.", body: <RegexBody env={env} /> },
    { id: "final-cut", title: "Final cut", description: "What happens after the narrator writes and before the reply is saved.", body: <FinalCutBody env={env} /> },
  ] };
}
