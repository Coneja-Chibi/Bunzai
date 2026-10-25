/**
 * The Compendium's Settings tab (RoleCall `CompendiumSettings.tsx`, `rc-world-comp-settings.png`): the header and its Essentials / Advanced switch,
 * then the section cards of the chosen view. Mount `CompendiumSettingsTab` as the World wing's Compendium > Settings tab (Track A's shell, branch
 * wt/comp-views); it needs the app, the scene and a way to hand a changed scene back to the page.
 *
 * Folders are the schema: each section is its own file and takes the same `SectionProps`, and SECTIONS is the one list the tab draws, in order.
 * Track C's filing, language and may-file sections sit here beside these. A section is drawn only when something reads what it sets (no dead
 * controls), so the rest of RoleCall's page arrives with the passes that need it. Showing the tab writes nothing (04b F9): defaults are
 * resolved on read, and only a change the person makes is sent.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../../../../app-contract";
import type { GuideRecord } from "../../../../../../core/guide-record";
import type { Chat, ChatCompendiumPatch } from "../../../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { useSceneCompendium } from "../../../use-scene-compendium";
import { useSceneLore } from "../../../use-scene-lore";
import { useSceneModels } from "../../../use-scene-models";
import { BooksSection } from "./books";
import type { SectionComponent, SectionProps, SettingsView } from "./deps";
import { AllowSection, FilingSection } from "./filing";
import { DiagnosticsSection } from "./diagnostics";
import { HistorianSection } from "./historian";
import { IngestSection } from "./ingest";
import { LanguageSection } from "./language";
import { MasterSection } from "./master";
import { ModelSection } from "./model";
import { SettingsSection, SettingsToggle } from "./parts";
import { RecallSection, TuningSection } from "./recall";
import { StandardizeSection } from "./standardize";
import { ConstraintsSection, TreeBuildSection } from "./tree";
import { COMPENDIUM_TREE_SETTINGS_STYLE } from "../../compendium-style-tree";
import { COMPENDIUM_SETTINGS_STYLE } from "./settings-style";

/**
 * "Narrator lookup" (RoleCall `CompendiumSettings.tsx:1400-1414`): the Narrator explore tool, one switch, off by default. On, the writing model may search
 * the books the Compendium can read, and read entries, while it writes (`studio/compendium-lookup.ts`). It needs the scene's Narrator Tool Access too
 * (Control Booth > Runtime Setup), as RoleCall's `agentLoopEnabled` gates the same tool, so the row says when that is off.
 */
function LookupSection({ chat, compendium, set }: SectionProps): JSX.Element {
  return (
    <SettingsSection id="lookup" title="Narrator lookup" blurb="The narrator can call explore_lorebook mid-generation when it needs typed context it doesn't already have. Adds latency but lets the narrator actively look things up." dot="var(--bk-role-warn)">
      <SettingsToggle on={compendium.resolved.lookup} label="Narrator explore tool" hint="Give the narrator a search tool it can call mid-generation. Trades latency for accuracy." onChange={(on) => void set({ lookup: on })} />
      {compendium.resolved.lookup && chat.prompting?.toolAccess !== true && <p className="cps-hint">Narrator Tool Access is off, so the narrator is not given this tool. Turn it on in the Control Booth under Runtime Setup.</p>}
    </SettingsSection>
  );
}

export const SECTIONS: readonly { id: string; view: SettingsView; Section: SectionComponent }[] = [
  { id: "master", view: "essentials", Section: MasterSection },
  { id: "model", view: "essentials", Section: ModelSection },
  { id: "books", view: "essentials", Section: BooksSection },
  { id: "recall", view: "essentials", Section: RecallSection },
  { id: "filing", view: "essentials", Section: FilingSection },
  { id: "language", view: "essentials", Section: LanguageSection },
  { id: "constraints", view: "advanced", Section: ConstraintsSection },
  { id: "tree", view: "advanced", Section: TreeBuildSection },
  { id: "tuning", view: "advanced", Section: TuningSection },
  { id: "lookup", view: "advanced", Section: LookupSection },
  { id: "allow", view: "advanced", Section: AllowSection },
  { id: "historian", view: "advanced", Section: HistorianSection },
  { id: "ingest", view: "advanced", Section: IngestSection },
  { id: "diagnostics", view: "advanced", Section: DiagnosticsSection },
  { id: "standardize", view: "advanced", Section: StandardizeSection },
];

const VIEWS: readonly { id: SettingsView; label: string }[] = [{ id: "essentials", label: "Essentials" }, { id: "advanced", label: "Advanced" }];

export function CompendiumSettingsTab({ ctx, chat, onChat, bookId }: { ctx: AppContext; chat: Chat; onChat(chat: Chat): void; bookId?: string }): JSX.Element {
  const [view, setView] = useState<SettingsView>("essentials");
  const [guides, setGuides] = useState<readonly GuideRecord[] | null>(null);
  const compendium = useSceneCompendium(ctx, chat, onChat);
  const lore = useSceneLore(ctx, chat.id);
  const models = useSceneModels(ctx, chat, onChat);
  useEffect(() => {
    let live = true;
    ctx.api.listGuides().then((g) => live && setGuides(g), () => live && setGuides([]));
    return () => { live = false; };
  }, [ctx]);
  const set = (change: ChatCompendiumPatch): Promise<void> =>
    compendium.patch(change).catch((e: unknown) => ctx.setStatus(`could not save the Compendium settings: ${toErrorMessage(e, "the scene refused it")}`));
  const props: SectionProps = { ctx, chat, compendium, lore, models, guides, bookId, set };
  return (
    <div className="cps" data-part="compendium.settings">
      <style>{COMPENDIUM_SETTINGS_STYLE + COMPENDIUM_TREE_SETTINGS_STYLE}</style>
      <header className="cps-hd">
        <div className="cps-eb">Compendium settings</div>
        <h1>What Compendium remembers</h1>
        <p>Choose which books it may use, what it should recall before a reply, and what lasting changes it should file afterward.</p>
        <div className="cps-views" role="group" aria-label="Settings view">
          {VIEWS.map((v) => <button type="button" key={v.id} aria-pressed={view === v.id} className={view === v.id ? "on" : undefined} onClick={() => setView(v.id)}>{v.label}</button>)}
        </div>
      </header>
      {SECTIONS.filter((s) => s.view === view).map(({ id, Section: S }) => <S key={id} {...props} />)}
    </div>
  );
}
