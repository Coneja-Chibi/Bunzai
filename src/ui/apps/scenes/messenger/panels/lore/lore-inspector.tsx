/**
 * The Lorebooks panel's entry inspector (panels.html 3e), a thread-style view of one entry: a back arrow, the entry's name, its book and token cost, the Enabled switch, then Simple and
 * Advanced tabs, a Saving line and Delete. The tabs are the wing's "Show advanced settings" disclosure (the `scenes.loreAdvanced` pref), so a person who opened Advanced in Full Chat finds
 * it open here. Every field writes through the wing's `editEntry`, the one debounced entry writer (saves two seconds after the last keystroke, and on Back), using the same field parts the
 * Full Chat editor draws (TriggerBox, LoreNum, the injection picker...). What the wireframe draws without a field behind it (an "Entry type: World" menu, a Keywords trigger mode) is not drawn.
 */
import type { JSX, ReactNode } from "react";
import type { LorebookEntry } from "../../../../../../entities/lorebook/schema";
import type { SceneLoreBook } from "../../../../../app-contract-scenes";
import { ExpandTextarea } from "../../../../../components/expand";
import { Button, IconButton, Segmented, Tabs, Toggle } from "../../../../../components/button";
import { Ic } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import { entryTokens } from "../../../lore-core";
import { LoreHelp, LoreNum } from "../../../lore-fields";
import { LOGIC } from "../../../scene-lore-entry";
import { TriggerBox } from "../../../scene-lore-keys";
import { LoreAdvanced } from "./lore-inspector-advanced";
import { DeleteNote, orderedEntries } from "./lore-list";
import type { LoreApi } from "./lore-panel";

export function Fld({ label, hint, aside, children }: { label: string; hint?: string; aside?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <div className="msn-lore-fld">
      <span className="lbl">{label}{aside}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

const clampPercent = (n: number): number => Math.min(100, Math.max(0, n));

export function LoreInspector({ w, book, entry }: { w: LoreApi; book: SceneLoreBook; entry: LorebookEntry }): JSX.Element {
  const patch = (p: Partial<LorebookEntry>): void => w.editEntry(entry.id, p);
  const globalScan = w.bookLoaded.state === "ready" ? w.bookLoaded.entity.body.globalScanDepth : 4;
  const tokens = entryTokens(entry);
  const advancedKeys = entry.triggerMode === "advanced";
  const preserved = entry.metadata?.["preserve_during_standardize"] === true;
  const back = (): void => { w.entrySaver.flush(); w.setSelectedEntryId(null); };
  const note = w.entryNote;
  const order = orderedEntries(w.entries ?? []).all;
  const place = order.findIndex((e) => e.id === entry.id) + 1;
  return (
    <>
      <div className="msn-lore-top">
        <IconButton variant="quiet" size="sm" icon="lucide:arrow-left" label="Back to entries" data-part="scene.messenger.lore.back" onClick={back} />
        <div className="t"><b>{entry.title || "Untitled"}</b><small>{book.name} · {place > 0 ? `entry ${String(place)} of ${String(order.length)} · ` : ""}{tokens} tokens</small></div>
        <Toggle size="sm" label="Enabled" on={entry.enabled} data-part="scene.messenger.lore.enabled" onChange={(enabled) => patch({ enabled })} />
      </div>
      <div className="msn-lore-tabs">
        <Tabs label="Entry settings" data-part="scene.messenger.lore.tabs" value={w.advancedOpen ? "advanced" : "simple"}
          items={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Advanced" }]} onChange={(v) => { if ((v === "advanced") !== w.advancedOpen) w.toggleAdvanced(); }} />
      </div>
      <div className="msn-lore-main" data-part="scene.messenger.lore.entry-editor">
        <div className="wl-e msn-lore-ins">
          {w.advancedOpen ? <LoreAdvanced entry={entry} groups={w.groups} candidates={w.candidates} onPatch={patch} /> : (
            <>
              <Fld label="Entry title"><input type="text" value={entry.title} placeholder="Entry title..." aria-label="Entry title" onChange={(e) => patch({ title: e.target.value })} /></Fld>
              <Fld label="Entry type" hint="Constant entries are always in the prompt. Selective entries go in only when their triggers appear in the recent messages.">
                <Segmented label="Entry type" size="sm" value={entry.constant ? "constant" : "selective"} items={[{ value: "selective", label: "Selective" }, { value: "constant", label: "Constant" }]}
                  onChange={(v) => patch({ constant: v === "constant" })} />
              </Fld>
              <Fld label="Triggers" hint="Type a keyword or a /regex/ pattern and press Enter.">
                <TriggerBox triggers={entry.triggers} advanced={advancedKeys} placeholder="Add keyword..." onChange={(triggers) => patch({ triggers })} />
              </Fld>
              {!entry.constant && (
                <>
                  <Fld label="Secondary triggers"><TriggerBox triggers={entry.secondaryTriggers} two advanced={advancedKeys} placeholder="Secondary (optional)..." onChange={(secondaryTriggers) => patch({ secondaryTriggers })} /></Fld>
                  <Fld label="Selective logic">
                    <Segmented label="Selective logic" size="sm" value={entry.selectiveLogic} items={LOGIC.map((l) => ({ value: l.value, label: l.value.replace("_", " ").toUpperCase(), title: l.text }))} onChange={(selectiveLogic) => patch({ selectiveLogic })} />
                  </Fld>
                </>
              )}
              <div className="msn-lore-three">
                <Fld label="Insertion order"><LoreNum className="wl-num" label="Insertion order" value={entry.sortOrder} fallback={100} onChange={(sortOrder) => patch({ sortOrder })} /></Fld>
                <Fld label="Scan depth"><LoreNum className="wl-num" label="Scan depth" min={0} value={entry.scanDepth ?? globalScan} fallback={globalScan} onChange={(scanDepth) => patch({ scanDepth })} /></Fld>
                {!advancedKeys && <Fld label="Probability"><LoreNum className="wl-num" label="Entry probability" min={0} max={100} value={entry.probability} fallback={100} onChange={(n) => patch({ probability: clampPercent(n) })} /></Fld>}
              </div>
              <Fld label="Entry content" aside={<LoreHelp title="Entry Content" text="The text that will be injected into context when this entry triggers. {{user}} and {{char}} are replaced with the persona and character names." />}>
                <ExpandTextarea label="Entry content" className="wl-ta" value={entry.content} placeholder="Enter the lore content that will be injected..." aria-label="Entry content" onChange={(e) => patch({ content: e.target.value })} />
                <div className="wl-mac"><span className="m"><code>{"{{user}}"}</code><code>{"{{char}}"}</code><span>macros</span></span><span className="tk">~{tokens} tokens</span></div>
              </Fld>
              <div className="msn-lore-set">
                <div className="tx"><b>Preserve during standardization</b><span className="d">The Compendium&apos;s standardize run skips this entry: its title, content, keys and metadata are never sent to the model. Use it for a hand-curated entry whose wording matters.</span></div>
                <Toggle size="sm" on={preserved} aria-label="Preserve during standardization" data-part="scene.messenger.lore.preserve" onChange={(on) => patch({ metadata: { ...entry.metadata, preserve_during_standardize: on } })} />
              </div>
            </>
          )}
        </div>
        {note && <div className={`wl-note${note.kind === "saved" ? "" : " warn"}`}><Ic name={note.kind === "saved" ? "lucide:check" : "lucide:triangle-alert"} size={14} />{note.text}</div>}
        <DeleteNote w={w} bookName={book.name} />
      </div>
      <footer className="msn-lore-foot">
        {w.saving > 0 ? <span className="sv"><Ic name="lucide:loader-circle" size={12} />Saving...</span> : <span>Saves as you type</span>}
        <span className="grow" />
        <span {...protect("entry-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" data-part="scene.messenger.lore.delete" onClick={() => w.actions.onDeleteRequest(entry.id)}>Delete entry</Button></span>
      </footer>
    </>
  );
}
