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
import { Tabs } from "../../components/button";

type Tab = "lorebook" | "compendium";

export function WorldWing({ lore, compendium, linked, initialTab, single }: { lore: JSX.Element; compendium: JSX.Element; linked: string; initialTab?: string; single?: boolean }): JSX.Element {
  const [tab, setTab] = useState<Tab>(() => tabOr(["lorebook", "compendium"], initialTab, pendingStoryboards() ? "compendium" : "lorebook"));
  const card = (label: string, meta?: string): JSX.Element => <><b>{label}</b>{meta && <small>{meta}</small>}</>;
  return (
    <>
      {!single && <nav className="fold wfold" data-part="scene.world.tabs">
        <div className="crumb">Scene <i>/</i> <b>World</b></div>
        <div className="tabs"><Tabs label="World sections" items={[{ value: "lorebook", label: card("Lorebook", linked) }, { value: "compendium", label: card("Compendium") }]} value={tab} onChange={setTab} /></div>
      </nav>}
      <div className="wtab" hidden={tab !== "lorebook"} data-part="scene.world.lorebook"><ThemeSlot id="scene.wing.world.lorebook" />{lore}</div>
      {tab === "compendium" && <div className="wtab" data-part="scene.world.compendium"><ThemeSlot id="scene.wing.world.compendium" />{compendium}</div>}
    </>
  );
}
