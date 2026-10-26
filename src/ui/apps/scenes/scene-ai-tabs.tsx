/**
 * The AI wing's chrome (RoleCall `FoldoutTabs` for `right-ai`, `right-wing-groups.ts:103-107`): the "Tools / AI" crumb over
 * two equal cards, MODEL and GENERATION. MOUNT POINT for the Generation tab: pass it as `generation`
 * (scene-wings.tsx `WingPanel`'s `aiGeneration` prop); until one is passed the card opens an honest empty state.
 * The Model tab stays mounted (hidden) while Generation shows, so its search and place in the list are kept.
 */
import { useState, type JSX } from "react";
import { Tabs } from "../../components/button";
import { ThemeSlot } from "../../_shared/theme-slot";
import { Ic } from "../../_shared/ic";
import { tabOr } from "./scene-wing-data";

type Tab = "model" | "generation";
const AI_TABS: readonly { value: Tab; label: string }[] = [{ value: "model", label: "Model" }, { value: "generation", label: "Generation" }];

export function AiTabs({ model, generation, initialTab, single }: { model: JSX.Element; generation?: JSX.Element; initialTab?: string; single?: boolean }): JSX.Element {
  const [tab, setTab] = useState<Tab>(() => tabOr(["model", "generation"], initialTab, "model"));
  return (
    <>
      {!single && <nav className="fold wfold" data-part="scene.ai">
        <div className="crumb">Tools <i>/</i> <b>AI</b></div>
        <Tabs label="AI sections" items={AI_TABS} value={tab} onChange={setTab} />
      </nav>}
      <div className="wtab" hidden={tab !== "model"} data-part="scene.ai.model"><ThemeSlot id="scene.wing.ai.model" />{model}</div>
      {tab === "generation" && (
        <div className="wtab"><ThemeSlot id="scene.wing.ai.generation" />{generation ?? <div className="wbody"><div className="quiet"><div><Ic name="lucide:sliders-horizontal" size={32} /><div>Generation is not built yet.</div></div></div></div>}</div>
      )}
    </>
  );
}
