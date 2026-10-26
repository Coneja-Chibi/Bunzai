/**
 * The Prompting wing's Preset tab (approved wireframe rc-port/scene-preset-wing.html): RoleCall's
 * PresetPanel on Bunraku's library. The scene follows its library preset (ChatStore rule 19, owner
 * decision 2026-09-28): the switches and sampler values set here are the scene's own and save to the
 * scene; prompt text edits save to the preset in the library, guarded by its revision, so every
 * scene using it sends the new text. The picker lists the library's presets; "Open in Workbench"
 * leads to the full editor.
 *
 * Writes never race each other: the scene's values are saved after a short pause, and on closing
 * the wing; text saves belong to the one writer the Prompting wing owns (use-scene-preset-text.ts),
 * shared with the Writing Tools tab.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PresetBody, PresetPrompt } from "../../../entities/preset/schema";
import type { Chat, ChatPreset } from "../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../_shared/error-message";
import { Ic } from "../../_shared/ic";
import { toggleBlock, toggleGroup, type SamplerKey } from "./preset-core";
import { useScenePresetOwn } from "./use-scene-preset-own";
import { useSceneChoices } from "./use-scene-choices";
import { ChoicesRow } from "./scene-choices";
import { referencedPromptIds, resolveSelections } from "../../../core/macros/choice-groups";
import { effectiveToggles, toChoiceGroups } from "../../../core/preset/choices";
import { PromptEditor, PromptList, SamplerBar } from "./scene-preset-parts";
import { TemplatesSection } from "./scene-preset-templates";
import type { PresetText } from "./use-scene-preset-text";
import { IconButton, ListRow } from "../../components/button";
import { VirtualRows } from "../../_shared/virtual-list";

const PRESET_ROW_PX = 52;

/** How the tab reads in the fold: "14 of 22 on", or that none is chosen. */
export function presetTabMeta(chat: Chat, body: PresetBody | null): string {
  if (!chat.preset || !body) return "None chosen";
  const groups = toChoiceGroups(body.choices);
  const toggles = effectiveToggles(groups, resolveSelections(groups, chat.regex?.choices?.[chat.preset.id]), chat.preset.toggles);
  const on = body.prompts.filter((p) => toggles[p.id] ?? p.enabled).length;
  return `${on} of ${body.prompts.length} on`;
}

export function PresetWing({ ctx, chat, text, onChanged }: { ctx: AppContext; chat: Chat; text: PresetText; onChanged(chat: Chat): void }): JSX.Element {
  const presetId = chat.preset?.id ?? null;
  const { loaded, reloads, note, setNote, load, saveText } = text;
  const [switching, setSwitching] = useState(false);
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // The shell rebuilds ctx on every status change; these refs keep the wing from reloading with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  /** The scene's own values (use-scene-preset-own.ts, shared with the Control Booth). */
  const { own, save: saveOwn, setSamplerValue, saver } = useScenePresetOwn(ctx, chat, onChanged, (why) => setNote({ kind: "failed", text: why }));
  const choices = useSceneChoices(ctx, chat, loaded.state === "ready" ? loaded.entity.body : null, onChanged);

  useEffect(() => setSelected(null), [presetId]);
  useEffect(() => {
    if (loaded.state === "ready" && !switching) return;
    let live = true;
    api.current.listEntities("preset").then((list) => live && setLibrary(list)).catch(() => live && setLibrary([]));
    return () => { live = false; };
  }, [loaded.state, switching]);

  const pick = async (id: string | null) => {
    setQuery("");
    // The current preset again keeps its switches and samplers: it only leaves the picker.
    if (id === presetId) {
      saver.flush();
      setSwitching(false);
      return;
    }
    // Waiting values belong to the preset being left.
    saver.cancel();
    try {
      changed.current(await api.current.setScenePreset(chat.id, id ? { id, toggles: {}, samplers: {} } : null));
      setSwitching(false);
    } catch (e) {
        setNote({ kind: "failed", text: toErrorMessage(e, "The preset could not be chosen.") });
    }
  };

  const openInWorkbench = () => {
    if (loaded.state !== "ready") return;
    ctx.workbench.open({ id: loaded.entity.id, kind: "preset", name: loaded.entity.body.name });
    ctx.openApp("workbench");
  };

  if (loaded.state === "loading") return <div className="wbody pp"><div className="ed-empty">Loading the preset...</div></div>;

  if (loaded.state === "failed") {
    return (
      <div className="wbody pp">
        <div className="pp-top">
          <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">Preset Error</div><h2>Could not <em>load</em></h2><p>The preset could not be read: {loaded.why}.</p></div></header>
          <div className="hero-tools"><IconButton variant="quiet" size="sm" icon="lucide:refresh-cw" label="Try again" onClick={() => void load(presetId)} /></div>
        </div>
      </div>
    );
  }

  if (loaded.state === "ready" && own && !switching) {
    const body = loaded.entity.body;
    const prompt = body.prompts.find((p) => p.id === selected) ?? null;
    return (
      <div className="wbody pp">
        <div className="pp-top">
          <header className="hero">
            <span className="hi"><Ic name="mdi:tune" size={20} /></span>
            <div><div className="eb">Edit Preset</div><h2>{title(body.name)}</h2><p>Tune prompts, samplers, and post-processing for this scene. Switches and samplers here are this scene&apos;s own; prompt text edits change the preset everywhere.</p></div>
          </header>
          <div className="hero-tools">
            <IconButton variant="quiet" size="sm" icon="lucide:pencil" label="Open in Workbench" onClick={openInWorkbench} />
            <IconButton variant="danger" size="sm" icon="lucide:trash-2" label="Run without a preset" onClick={() => void pick(null)} />
            <IconButton variant="quiet" size="sm" icon="lucide:library" label="Switch preset" onClick={() => { setQuery(""); setSwitching(true); }} />
          </div>
        </div>
        {note?.kind === "failed" && !prompt && <div className="note">{note.text}</div>}
        <ChoicesRow ctx={ctx} chat={chat} body={body} choices={choices} />
        <SamplerBar preset={body.samplers ?? {}} own={own.samplers} onSet={<K extends SamplerKey>(key: K, value: ChatPreset["samplers"][K]) => setSamplerValue(body.samplers, key, value)} />
        <div className="split">
          <PromptList key={presetId} prefs={ctx.prefs} body={body} toggles={effectiveToggles(choices.groups, choices.selections, own.toggles)} selected={selected} onSelect={setSelected} templates={(q) => <TemplatesSection body={body} text={text} query={q} />}
            onToggle={(p: PresetPrompt, on) => saveOwn({ ...own, toggles: toggleBlock(own.toggles, p, on, referencedPromptIds(choices.groups)) })}
            onToggleGroup={(list, on) => saveOwn({ ...own, toggles: toggleGroup(own.toggles, list, on, referencedPromptIds(choices.groups)) })} />
          <PromptEditor key={`${prompt?.id ?? ""}:${reloads}`} prompt={prompt} loadedAt={reloads} presetName={body.name} note={note} prefs={ctx.prefs} onText={saveText} onClose={() => setSelected(null)} />
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = (library ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  return (
    <div className="wbody pp" data-part="scene.prompting.preset">
      <div className="pp-top">
        {loaded.state === "gone" ? (
          <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">Preset Error</div><h2>Preset <em>Unavailable</em></h2><p>This scene&apos;s preset is no longer in your library. Choose another, or restore it from the Trash.</p></div></header>
        ) : (
          <header className="hero"><span className="hi"><Ic name="mdi:tune" size={20} /></span><div><div className="eb">{switching ? "Switch Preset" : "Select Preset"}</div><h2>Choose a <em>Preset</em></h2><p>Pick a recipe from your library to load prompts and sampler defaults for this scene. Without one, the scene sends the card, persona, and history in RoleCall&apos;s default order.</p></div></header>
        )}
        {switching && <div className="hero-tools"><IconButton variant="quiet" size="sm" icon="lucide:chevron-left" label="Back to editing" onClick={() => void pick(presetId)} /></div>}
      </div>
      {note?.kind === "failed" && <div className="note">{note.text}</div>}
      <div className="picker">
        <div className="pk-search"><div className="sb lg"><Ic name="lucide:search" size={14} /><input value={query} placeholder="Search my library..." aria-label="Search my library" onChange={(e) => setQuery(e.target.value)} /></div></div>
        <ListRow selected={!presetId} onClick={() => void pick(null)} leading={<Ic name="lucide:x" size={16} />}
          label="Run Without Preset" subtitle="RoleCall&apos;s default order: card, persona, history" />
        <h4 className="pk-hd">My Library ({library?.length ?? "..."})</h4>
        {library && shown.length === 0 && (
          <div className="pk-empty"><span><Ic name="lucide:sliders-horizontal" size={20} /></span><p>{q ? "No presets match your search" : "No presets found"}</p><small>{q ? "Try different keywords" : "Import one in the Library, or make one on the Workbench"}</small></div>
        )}
        <VirtualRows items={shown} keyOf={(s) => s.id} estimate={PRESET_ROW_PX} render={(s) => (
          <ListRow selected={s.id === presetId} onClick={() => void pick(s.id)} leading={initials(s.name)}
            label={s.name} subtitle={s.provenance || undefined} meta={s.id === presetId ? "Active" : undefined} />
        )} />
      </div>
    </div>
  );
}

/** RoleCall's hero title: the last word in the accent. */
function title(name: string): JSX.Element {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return <em>{name}</em>;
  return <>{words.slice(0, -1).join(" ")} <em>{words.at(-1)}</em></>;
}

const initials = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "P";
