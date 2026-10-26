/**
 * The World wing's entry editor (RoleCall's EntryPanel, drawn pixel for pixel): the header (status
 * dot, on switch, title; with advanced settings open also the Constant/Selective type, Order and Scan
 * boxes; the token estimate and close), the keyword boxes, the content well with its macros row, and
 * the "Show advanced settings" card that folds the rest (scene-lore-advanced.tsx). Every field writes
 * through `onPatch`, the wing's one entry writer. "Order" is the entry's sortOrder, the field Move up
 * and Move down swap and this engine places by. RoleCall's Order box wrote `priority` (its engine
 * places by `order ?? priority`, selection/priority.ts:60, and also cuts by it), while its Move wrote
 * sortOrder, which that engine does not place by; here the canonical split keeps placement
 * (sortOrder, edited here) apart from the budget cut (priority, not editable from this wing).
 * RoleCall's Preserve lock (`EntryPanel.tsx:959-994`) sits between the type and Order boxes: it sets
 * `metadata.preserve_during_standardize`, which the Compendium's Standardize run reads to leave the entry
 * as written (core/compendium/standardize-select.ts).
 */
import { useState, type JSX } from "react";
import type { LorebookEntry, SelectiveLogic } from "../../../entities/lorebook/schema";
import { ExpandTextarea } from "../../components/expand";
import { Ic } from "../../_shared/ic";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { entryTokens } from "./lore-core";
import { LoreHelp, LoreNum, LoreSwitch } from "./lore-fields";
import { CharacterFilter, CrossEntryBoost, Injection, SideEffects } from "./scene-lore-advanced";
import { TriggerBox } from "./scene-lore-keys";
import { Button, Chip, Disclosure, IconButton, MenuItem, Segmented } from "../../components/button";

const LOGIC: readonly { value: SelectiveLogic; text: string }[] = [
  { value: "and_any", text: "Primary + any secondary matches" },
  { value: "and_all", text: "Primary + all secondaries match" },
  { value: "not_any", text: "Primary + no secondaries match" },
  { value: "not_all", text: "Primary + not all secondaries match" },
];

function Probability({ value, onChange }: { value: number; onChange(n: number): void }): JSX.Element {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return <Chip data-part="scene.lore.probability" title="Entry Probability. Chance that this entry activates after its triggers match. In simple mode, all triggers share this probability." aria-label="Entry probability" onClick={() => setEditing(true)}>{value}%</Chip>;
  }
  return (
    <span className="wl-prob"><input type="number" min={0} max={100} autoFocus defaultValue={value} aria-label="Entry probability"
      onBlur={(e) => { const n = Number.parseInt(e.target.value, 10); onChange(Number.isNaN(n) ? 100 : Math.min(100, Math.max(0, n))); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (isEscapeClose(e)) setEditing(false); }} />%</span>
  );
}

export function EntryEditor({ entry, globalScanDepth, boostCandidates, groups, advancedOpen, onToggleAdvanced, note, onPatch, onClose }: {
  entry: LorebookEntry;
  /** The book's own default, shown in Scan while the entry inherits it. */
  globalScanDepth: number;
  /** The book's entries (id and title), for naming a Cross-Entry Boosting target. */
  boostCandidates: readonly { id: string; title: string }[];
  groups: readonly string[];
  advancedOpen: boolean;
  onToggleAdvanced(): void;
  note: { kind: "saved" | "stale" | "failed"; text: string } | null;
  onPatch(patch: Partial<LorebookEntry>): void;
  onClose(): void;
}): JSX.Element {
  const [typeOpen, setTypeOpen] = useState(false);
  const [logicOpen, setLogicOpen] = useState(false);
  const advancedKeys = entry.triggerMode === "advanced";
  const tokens = entryTokens(entry);
  return (
    <div className="wl-e" data-part="scene.world.entry">
      <div className="wl-eh">
        <div className="wl-eh1">
          <i className={`dot${entry.constant ? " con" : ""}`} />
          <LoreSwitch on={entry.enabled} onChange={(enabled) => onPatch({ enabled })} label="Entry enabled" />
          <input className="wl-ti" type="text" value={entry.title} placeholder="Entry title..." aria-label="Entry title" onChange={(e) => onPatch({ title: e.target.value })} />
        </div>
        <div className="wl-eh2">
          {advancedOpen && (
            <>
              <span className="wl-rel">
                <Button data-part="scene.lore.type" size="sm" menu aria-expanded={typeOpen} onClick={() => setTypeOpen(!typeOpen)} onBlur={() => setTimeout(() => setTypeOpen(false), 200)}>
                  {entry.constant ? "Constant" : "Selective"}
                </Button>
                <LoreHelp title="Entry Type" text="Constant entries are always injected into context. Selective entries are injected only when their keywords are found in chat history." />
                {typeOpen && (
                  <div className="wl-dd r" role="menu">
                    <MenuItem role="menuitemradio" checked={!entry.constant} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPatch({ constant: false }); setTypeOpen(false); }}>Selective</MenuItem>
                    <MenuItem role="menuitemradio" checked={entry.constant} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPatch({ constant: true }); setTypeOpen(false); }}>Constant</MenuItem>
                  </div>
                )}
              </span>
              {(() => {
                const preserved = entry.metadata?.["preserve_during_standardize"] === true;
                return (
                  <Chip pressed={preserved}
                    aria-label={preserved ? "Preserved during standardize, click to allow rewrites" : "Preserve during standardize"}
                    title="Preserve During Standardization. When on, the Compendium's standardize run skips this entry entirely: its title, content, keys and metadata are never sent to the model for rewriting or splitting. Off (default): the run may classify, rewrite, split or rephrase it. On: it stays in classic form until you turn this off. Use it for a hand-curated entry whose exact wording matters."
                    onClick={() => onPatch({ metadata: { ...entry.metadata, preserve_during_standardize: !preserved } })}>
                    <Ic name="lucide:lock" size={14} />{preserved ? "Preserved" : "Preserve"}
                  </Chip>
                );
              })()}
              <span className="wl-rel">
                <span className="wl-ord"><span>Order</span><LoreNum className="wl-num" label="Insertion order" value={entry.sortOrder} fallback={100} onChange={(sortOrder) => onPatch({ sortOrder })} /></span>
                <LoreHelp title="Insertion Order" text="Controls where this entry appears relative to other entries. Higher numbers are inserted later (closer to the AI response)." />
              </span>
              <span className="wl-rel">
                <span className="wl-scn"><span>Scan</span><LoreNum className="wl-num" label="Scan depth" min={0} value={entry.scanDepth ?? globalScanDepth} fallback={globalScanDepth} onChange={(scanDepth) => onPatch({ scanDepth })} /></span>
                <LoreHelp title="Scan Depth" text="How many recent messages to scan when looking for trigger keywords. Depth 4 scans the last 4 messages." />
              </span>
            </>
          )}
          <span className="wl-tk" title="Token Estimate. Approximate token count for this entry content.">~{tokens}</span>
          <IconButton variant="quiet" size="sm" icon="lucide:x" label="Close this entry panel" title="Close Panel. Closes this editor panel. The entry remains in the lorebook." onClick={onClose} />
        </div>
      </div>

      <div className="wl-ec">
        <div>
          {advancedOpen && (
            <div className="wl-tm">
              <Segmented label="Trigger mode" size="sm" items={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Advanced" }]}
                value={advancedKeys ? "advanced" : "simple"} onChange={(triggerMode) => onPatch({ triggerMode })} />
              <LoreHelp title="Trigger Mode" text="Simple: all triggers share one probability. Advanced: each trigger has its own probability % and optional cooldown." />
              {advancedKeys && <em>per-trigger %</em>}
              {!advancedKeys && <Probability value={entry.probability} onChange={(probability) => onPatch({ probability })} />}
            </div>
          )}
          <div className="wl-keys">
            <div className="col"><TriggerBox triggers={entry.triggers} advanced={advancedKeys} placeholder="Add keyword..." onChange={(triggers) => onPatch({ triggers })} /></div>
            {advancedOpen && (
              <>
                <div className="wl-lg">
                  <Button data-part="scene.lore.logic" variant="quiet" size="sm" menu aria-expanded={logicOpen} onClick={() => setLogicOpen(!logicOpen)} onBlur={() => setTimeout(() => setLogicOpen(false), 200)}>
                    {entry.selectiveLogic.replace("_", " ").toUpperCase()}
                  </Button>
                  {logicOpen && (
                    <div className="wl-dd" role="menu">
                      {LOGIC.map((l) => (
                        <MenuItem role="menuitemradio" key={l.value} checked={entry.selectiveLogic === l.value} description={l.text} onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { onPatch({ selectiveLogic: l.value }); setLogicOpen(false); }}>{l.value.replace("_", " ").toUpperCase()}</MenuItem>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col"><TriggerBox triggers={entry.secondaryTriggers} two advanced={advancedKeys} placeholder="Secondary (optional)..." onChange={(secondaryTriggers) => onPatch({ secondaryTriggers })} /></div>
              </>
            )}
          </div>
        </div>

        {advancedOpen && <Injection entry={entry} groups={groups} onPatch={onPatch} />}

        <div>
          <div className="wl-sec" style={{ marginBottom: 4 }}>
            <span className="wl-lb">Content</span>
            <LoreHelp title="Entry Content" text="The text that will be injected into context when this entry triggers. {{user}} and {{char}} are replaced with the persona and character names." />
          </div>
          <ExpandTextarea label="Entry content" className="wl-ta" value={entry.content} placeholder="Enter the lore content that will be injected..." aria-label="Entry content" onChange={(e) => onPatch({ content: e.target.value })} />
          <div className="wl-mac">
            <span className="m"><code>{"{{user}}"}</code><code>{"{{char}}"}</code><span>macros</span></span>
            <span className="tk">~{tokens} tokens</span>
          </div>
        </div>

        <Disclosure data-part="scene.lore.advanced" open={advancedOpen} onClick={onToggleAdvanced} label={advancedOpen ? "Hide advanced settings" : "Show advanced settings"}
          summary="Order, timing, injection position, filters, and the rest of the machinery." />

        {advancedOpen && (
          <>
            <SideEffects value={entry.sideEffects} onChange={(sideEffects) => onPatch({ sideEffects })} />
            <div className="wl-adv2">
              <CharacterFilter entry={entry} onPatch={onPatch} />
              <CrossEntryBoost entry={entry} candidates={boostCandidates} onPatch={onPatch} />
            </div>
          </>
        )}
        {note && <div className={`wl-note${note.kind === "saved" ? "" : " warn"}`}><Ic name={note.kind === "saved" ? "lucide:check" : "lucide:triangle-alert"} size={14} />{note.text}</div>}
      </div>
    </div>
  );
}
