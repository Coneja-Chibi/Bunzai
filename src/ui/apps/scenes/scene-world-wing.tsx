/**
 * The World wing's chrome (RoleCall `FoldoutTabs` and the `left-world` group, `LeftWingPanelContent.tsx:245-252`): the
 * "Scene / World" crumb over two equal cards, LOREBOOK with its "N linked" line and COMPENDIUM. The Lorebook tab stays
 * mounted (hidden) while the Compendium shows, so its pending typed edit and its save queue are never unmounted away; the
 * Compendium mounts only when opened, so it reads nothing until then.
 */
import { useState, type JSX } from "react";
import { ThemeSlot } from "../../_shared/theme-slot";
import { pendingStoryboards } from "./compendium/storyboards/storyboards-open";
import { tabOr } from "./scene-wing-data";

type Tab = "lorebook" | "compendium";

export function WorldWing({ lore, compendium, linked, initialTab }: { lore: JSX.Element; compendium: JSX.Element; linked: string; initialTab?: string }): JSX.Element {
  const [tab, setTab] = useState<Tab>(() => tabOr(["lorebook", "compendium"], initialTab, pendingStoryboards() ? "compendium" : "lorebook"));
  const card = (id: Tab, label: string, meta?: string): JSX.Element => (
    <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
      <b>{label}</b>{meta && <small>{meta}</small>}
    </button>
  );
  return (
    <>
      <nav className="fold wfold" data-part="scene.world.tabs">
        <div className="crumb">Scene <i>/</i> <b>World</b></div>
        <div className="tabs" role="tablist" aria-label="World sections">{card("lorebook", "Lorebook", linked)}{card("compendium", "Compendium")}</div>
      </nav>
      <div className="wtab" hidden={tab !== "lorebook"} data-part="scene.world.lorebook"><ThemeSlot id="scene.wing.world.lorebook" />{lore}</div>
      {tab === "compendium" && <div className="wtab" data-part="scene.world.compendium"><ThemeSlot id="scene.wing.world.compendium" />{compendium}</div>}
    </>
  );
}
