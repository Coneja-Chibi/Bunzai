/**
 * The Prompting wing (RoleCall's left "Prompting" rail): its tabs. Preset is RoleCall's preset panel
 * (scene-preset-wing.tsx); Guides lists the guided responses and switches them on for this scene
 * (scene-guides-wing.tsx); Scene Note keeps the scene's persistent guidance (scene-note-wing.tsx); Writing Tools
 * lists the built writing tools with the prompts they use (scene-writing-tools.tsx). The
 * Guides and Scene Note settings are the scene's own (ChatStore rule 37). Each tab's panel is built
 * only while it is showing, so leaving a tab saves what it holds.
 */
import { useState, type JSX } from "react";
import type { PresetBody } from "../../../entities/preset/schema";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatNote } from "../../../stage/contracts/chat-store";
import { PresetWing, presetTabMeta } from "./scene-preset-wing";
import { SceneGuidesWing, guidesTabMeta } from "./scene-guides-wing";
import { NOTE_TAB_META, SceneNoteWing, noteSaveFailure } from "./scene-note-wing";
import { SceneWritingTools } from "./scene-writing-tools";
import { useScenePrompting } from "./use-scene-prompting";
import { ThemeSlot } from "../../_shared/theme-slot";
import { useScenePresetText } from "./use-scene-preset-text";
import { tabOr } from "./scene-wing-data";
import { Tabs } from "../../components/button";

type TabId = "preset" | "guides" | "note" | "tools";

export function PromptingWing({ ctx, chat, presetBody, onChanged, onBody, initialTab, single }: {
  ctx: AppContext;
  /** Draw only `initialTab`'s body (a Messenger section): no crumb, no tab bar. */
  single?: boolean;
  /** The tab to open on (a Messenger program); Preset when absent or unknown. */
  initialTab?: string;
  chat: Chat;
  presetBody: PresetBody | null;
  onChanged(chat: Chat): void;
  onBody(body: PresetBody | null): void;
}): JSX.Element {
  const [tab, setTab] = useState<TabId>(() => tabOr<TabId>(["preset", "guides", "note", "tools"], initialTab, "preset"));
  const prompting = useScenePrompting(ctx, chat, onChanged);
  /** The scene preset's one text writer, shared by the tabs that edit its text. */
  const presetText = useScenePresetText(ctx, chat.preset?.id ?? null, onBody);
  const on = chat.prompting?.guides ?? [];
  /** A failed note save is also said on the status line: the tab may be closed by the time it fails (a save waiting when it closes is sent then). */
  const saveNote = (note: ChatNote): Promise<void> => prompting.patch({ note }).catch((e: unknown) => {
    ctx.setStatus(noteSaveFailure(e));
    throw e;
  });
  const tabs: readonly { id: TabId; label: string; meta: string }[] = [
    { id: "preset", label: "Preset", meta: presetTabMeta(chat, presetBody) },
    { id: "guides", label: "Guides", meta: guidesTabMeta(prompting, on) },
    { id: "note", label: "Scene Note", meta: NOTE_TAB_META },
    { id: "tools", label: "Writing Tools", meta: "" },
  ];
  return (
    <>
      {!single && <nav className="fold" data-part="scene.prompting">
        <div className="crumb">Prompting <i>/</i> <b>{tabs.find((t) => t.id === tab)!.label}</b></div>
        <div className="tabs" data-part="scene.prompting.tabs">
          <Tabs label="Prompting sections" items={tabs.map((t) => ({ value: t.id, label: <><b>{t.label}</b><small>{t.meta}</small></> }))} value={tab} onChange={setTab} />
        </div>
      </nav>}
      {tab === "preset" && <><ThemeSlot id="scene.wing.prompting.preset" /><PresetWing ctx={ctx} chat={chat} text={presetText} onChanged={onChanged} /></>}
      {tab === "guides" && <><ThemeSlot id="scene.wing.prompting.guides" /><SceneGuidesWing prompting={prompting} on={on} /></>}
      {tab === "note" && <><ThemeSlot id="scene.wing.prompting.note" /><SceneNoteWing saved={chat.prompting?.note} onSave={saveNote} /></>}
      {tab === "tools" && <><ThemeSlot id="scene.wing.prompting.tools" /><SceneWritingTools text={presetText} /></>}
    </>
  );
}
