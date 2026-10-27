/**
 * The scene scope's Compendium page (Full Chat: the World wing's Compendium > Settings tab, grouped as it groups them): the master switch, the model, Narrator lookup and output language first, then books, the
 * two passes (before and after a reply), and under them the tree, Historian, import and Standardize settings. Every row is bound to the writer the Settings tab uses (`useSceneCompendium.patch`, compendium-env.ts)
 * and reads the resolved value, so a scene with nothing saved shows the defaults and nothing is written to show them. The Compendium itself (browse, notes, diagnostics, runs) is a drill row to its program.
 */
import type { JSX } from "react";
import { MAX_LANGUAGE } from "../../../../../../core/compendium/defaults";
import { modelChoices, keyOf, useSceneModels } from "../../../use-scene-models";
import { DrillRow, SelectRow } from "../../frames/settings-rows";
import type { SettingsCategory } from "../../frames/settings-window";
import { onChatOf, type WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { BookAccessRows, WriteBookRows } from "./compendium-books";
import { useCompendiumSet } from "./compendium-env";
import { AllowRows, FilingRows, RecallRows, TuningRows } from "./compendium-passes";
import { HistorianRows, IngestRows, StandardizeRows, TreeRows } from "./compendium-tools";
import { CheckedText } from "./drafts";
import { SavedToggle } from "./saved";

/** The master switch, the Compendium's own model (unset, the scene's model answers), Narrator lookup and the output language. */
function MasterRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { ctx, chat, compendium, set } = useCompendiumSet(a);
  const models = useSceneModels(ctx, chat, onChatOf(a));
  const r = compendium.resolved;
  const choices = modelChoices(models);
  const current = r.model ? keyOf(r.model) : "";
  const options = [{ value: "", label: "Use this scene's model" }, ...(current && !choices.some((c) => c.value === current) ? [{ value: current, label: current.replace("|", ": ") }] : []), ...choices.map((c) => ({ value: c.value, label: c.label }))];
  return (
    <>
      <SavedToggle label="Use Compendium in this scene" description="Reads the books below before each reply. Nothing is read or sent while this is off." saved={r.on} write={(on) => set({ on })} />
      <SelectRow label="Compendium model" description="The model Compendium uses to pick what the narrator should see. Unset, this scene's own model answers." value={current} options={options}
        onChange={(key) => { const hit = choices.find((c) => c.value === key); void set({ model: key === "" ? null : hit?.conn ?? null }); }} />
      <SavedToggle label="Narrator explore tool" description={`Give the narrator a search tool it can call mid-generation. Trades latency for accuracy.${r.lookup && chat.prompting?.toolAccess !== true ? " Narrator tool access is off, so the narrator is not given this tool." : ""}`} saved={r.lookup} write={(lookup) => set({ lookup })} />
      <CheckedText label="Output language" description="The language Compendium writes the entries it files in. Leave blank to follow the narrator's language." saved={r.language} rows={1}
        check={(t) => (t.length > MAX_LANGUAGE ? `Use at most ${MAX_LANGUAGE} characters.` : null)} write={(t) => set({ language: t.trim() === "" ? null : t.trim() })} />
      <DrillRow label="Compendium" description="Browse, file and tune filed world notes, and run Diagnostics." onOpen={() => open("compendium")} />
    </>
  );
}

function BooksRows({ a }: { a: WingArgs }): JSX.Element {
  return (
    <div data-part="scene.messenger.settings.compendium.books">
      <BookAccessRows a={a} />
      <WriteBookRows a={a} />
    </div>
  );
}

export function compendiumCategory(a: WingArgs, open: OpenProgram): SettingsCategory {
  // clone-ok: a settings category is a table of sections, the same shape as every other category by design
  return { id: "compendium", label: "Compendium", icon: "lucide:library-big", group: "Scene cast", sections: [
    { id: "comp-master", title: "Compendium", description: "Off until you turn it on. While it is off nothing is read or sent.", body: <MasterRows a={a} open={open} /> },
    { id: "comp-books", title: "Books in this chat", description: "A book starts read only: Compendium reads it and never changes it.", body: <BooksRows a={a} /> },
    { id: "comp-recall", title: "Before a reply", description: "Recall relevant people, places, facts and prior events before the narrator writes.", body: <RecallRows a={a} /> },
    { id: "comp-tuning", title: "Retrieval tuning", description: "How Compendium searches and how much context the retrieval pass receives.", body: <TuningRows a={a} /> },
    { id: "comp-filing", title: "After a reply", description: "Record lasting changes in the books you allowed it to write to.", body: <FilingRows a={a} /> },
    { id: "comp-allow", title: "What Compendium may file", description: "Which kinds of entry it is allowed to create or add to.", body: <AllowRows a={a} /> },
    { id: "comp-tree", title: "Tree building", description: "How the model sorts a book when the tree is built or rebuilt.", body: <TreeRows a={a} open={open} /> },
    { id: "comp-historian", title: "Historian summaries", description: "Periodic recaps of what happened, each belonging to a plot.", body: <HistorianRows a={a} /> },
    { id: "comp-ingest", title: "Import chat history", description: "Turn existing messages into typed entries in a batch.", body: <IngestRows a={a} open={open} /> },
    { id: "comp-standardize", title: "Standardization defaults", description: "What the Standardize run starts from. It converts untyped entries to typed ones and can be reverted.", body: <StandardizeRows a={a} open={open} /> },
  ] };
}
