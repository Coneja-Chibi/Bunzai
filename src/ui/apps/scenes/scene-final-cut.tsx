/**
 * The Final Cut wing (RoleCall's "Final Cut" rail, `post-production`: "Rewrites and text cleanup"). RoleCall hosts two tabs, Final Cut
 * (the post-generation passes, final-cut/final-cut-tab.tsx, ChatStore rule 44) and Regex (the scene's regex sets, ChatStore rule 42).
 * The wing opens on Final Cut, the first tab, as RoleCall's does.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { Tabs } from "../../components/button";
import { FinalCutTab } from "./final-cut/final-cut-tab";
import { SceneRegexWing, regexTabMetaOf } from "./scene-regex-wing";
import { ThemeSlot } from "../../_shared/theme-slot";
import { useSceneRegexPicks } from "./use-scene-regex-picks";
import { tabOr } from "./scene-wing-data";

type Tab = "cut" | "regex";

export function FinalCutWing({ ctx, chat, onChanged, initialTab }: { ctx: AppContext; chat: Chat; onChanged(chat: Chat): void; initialTab?: string }): JSX.Element {
  const [tab, setTab] = useState<Tab>(() => tabOr<Tab>(["cut", "regex"], initialTab, "cut"));
  const picks = useSceneRegexPicks(ctx, chat, onChanged);
  const tabs: readonly { id: Tab; label: string; meta: string }[] = [{ id: "cut", label: "Final Cut", meta: "" }, { id: "regex", label: "Regex", meta: regexTabMetaOf(picks) }];
  return (
    <>
      <nav className="fold" data-part="scene.finalcut.tabs">
        <div className="crumb">Scene <i>/</i> <b>Final Cut</b> <i>/</i> <b>{tabs.find((t) => t.id === tab)!.label}</b></div>
        <Tabs label="Final Cut sections" items={tabs.map((t) => ({ value: t.id, label: <><b>{t.label}</b>{t.meta && <small>{t.meta}</small>}</> }))} value={tab} onChange={setTab} />
      </nav>
      {tab === "cut" ? <><ThemeSlot id="scene.wing.finalcut.cut" /><FinalCutTab ctx={ctx} chat={chat} onChanged={onChanged} /></> : <><ThemeSlot id="scene.wing.finalcut.regex" /><SceneRegexWing ctx={ctx} picks={picks} /></>}
    </>
  );
}
