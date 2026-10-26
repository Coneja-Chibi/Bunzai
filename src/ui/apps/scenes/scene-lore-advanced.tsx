/**
 * The entry editor's advanced machinery (RoleCall's EntryPanel behind "Show advanced settings"):
 * Injection with the seven position cards and the Timing, Recursion and Group row, Side Effects, the
 * Character Filter and Cross-Entry Boosting. Every field drawn here is read by the activation engine or
 * prompt assembly (position and depth: core/assembly/lore-place.ts; sticky, cooldown, delay:
 * engine/timers.ts, fed by each turn's fire history; recursion: engine/recursion.ts; groups:
 * engine/groups.ts; the filter: engine/character-filter.ts; boosting: engine/boosting.ts; side effects:
 * core/assembly/lore-effects.ts, applied to the scene's own variables).
 */
import { useState, type JSX } from "react";
import type { EntrySideEffect, EntrySideEffects, InjectionPosition, LorebookEntry, MessageRole, SideEffectType } from "../../../entities/lorebook/schema";
import { recursionModeOf, recursionPatch, type RecursionMode } from "../../_shared/lore-recursion";
import { Button, Disclosure, IconButton, MenuItem, Segmented, type ChoiceItem } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { resolveBoostTarget } from "./lore-core";
import { LoreHelp, LoreNum } from "./lore-fields";

type Patch = (patch: Partial<LorebookEntry>) => void;

const ROLES: readonly { value: MessageRole; label: string }[] = [{ value: "system", label: "Sys" }, { value: "user", label: "Usr" }, { value: "assistant", label: "Ast" }];
const TIPS = {
  position: ["Injection Position", "Where in the context this entry's content will be placed. Different positions have different effects on how the AI interprets the information."],
  world: ["World Position", "Injected at the start of context with global world info. Best for universe rules, physics, or setting details that apply everywhere."],
  character: ["Character Position", "Injected near character definitions. Best for NPC details, relationship info, or character-specific lore."],
  scene: ["Scene Position", "Injected near recent messages. Best for situational context, current events, or temporary states."],
  depth: ["@ Depth Position", "Injected at a specific message depth with a custom role (system/user/assistant). Depth 0 is right before the AI response."],
  append: ["Append (Glue Onto Message)", "Glues this entry's content onto the END of the depth-th-from-last message of the chosen role instead of inserting a new message (system uses the user's message)."],
  top: ["Prepend Preset (Top)", "Pins this entry to the very TOP of the assembled prompt, before relative preset prompts and everything else."],
  bottom: ["Append Preset (Bottom)", "Pins this entry to the very END of the assembled prompt, after chat history, post-history prompts, and the Scene Note."],
} as const;

const tipOf = (tip: readonly [string, string]): string => `${tip[0]}. ${tip[1]}`;
const POSITIONS: readonly ChoiceItem<InjectionPosition>[] = [
  { value: "world", label: "World", title: tipOf(TIPS.world) },
  { value: "character", label: "Character", title: tipOf(TIPS.character) },
  { value: "scene", label: "Scene", title: tipOf(TIPS.scene) },
  { value: "depth", label: <><Ic name="lucide:map-pin" size={14} />@ Depth</>, title: tipOf(TIPS.depth) },
  { value: "append", label: <><Ic name="lucide:corner-down-right" size={14} />Append</>, title: tipOf(TIPS.append) },
  { value: "prepend_top", label: <><Ic name="lucide:arrow-up-to-line" size={14} />Top</>, title: tipOf(TIPS.top) },
  { value: "append_bottom", label: <><Ic name="lucide:arrow-down-to-line" size={14} />Bottom</>, title: tipOf(TIPS.bottom) },
];

/** The seven position cards as one picker; @ Depth and Append add a row below for the depth and the role to place it as. */
export function PositionPicker({ entry, onPatch }: { entry: LorebookEntry; onPatch: Patch }): JSX.Element {
  const pos = entry.position;
  return (
    <>
      <Segmented data-part="scene.lore.position" label="Injection position" items={POSITIONS} value={pos} onChange={(position) => onPatch({ position })} />
      {(pos === "depth" || pos === "append") && (
        <div className="wl-pd" title={tipOf(pos === "depth" ? TIPS.depth : TIPS.append)}>
          <LoreNum className="" label={pos === "depth" ? "Injection depth" : "Append depth"} value={entry.depth} min={0} fallback={pos === "depth" ? 4 : 0} onChange={(depth) => onPatch({ depth })} />
          <select value={entry.role} aria-label="Injection role" onChange={(e) => onPatch({ role: e.target.value as MessageRole })}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}
    </>
  );
}

const RECURSION_ITEMS = [
  { value: "normal", label: "Normal", title: "Normal Recursion. This entry's content is scanned for other entries' triggers, potentially activating them." },
  { value: "prevent", label: "Prevent", title: "Prevent Recursion. This entry's content will NOT trigger other entries." },
  { value: "delay", label: "Delay", title: "Delay Until Recursion. This entry only activates on a later pass of scanning, after other entries have been processed." },
] as const;
const FILTER_MODES = [{ value: "whitelist", label: "Whitelist" }, { value: "blacklist", label: "Blacklist" }, { value: "none", label: "None" }] as const;

export function Group({ entry, groups, onPatch }: { entry: LorebookEntry; groups: readonly string[]; onPatch: Patch }): JSX.Element {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const assign = (name: string): void => { onPatch({ groupName: name.trim(), groupWeight: 100 }); setInput(""); setOpen(false); };
  if (entry.groupName) {
    return (
      <span className="wl-gp">{entry.groupName}<span aria-hidden="true">&times;</span>
        <LoreNum label="Group weight" value={entry.groupWeight} fallback={100} onChange={(groupWeight) => onPatch({ groupWeight })} />
        <IconButton variant="quiet" size="sm" label="Remove from group" title="Remove From Group. Clears this entry group assignment and resets its group weight." icon={<span aria-hidden="true">&times;</span>} onClick={() => onPatch({ groupName: null, groupWeight: 100 })} />
      </span>
    );
  }
  const q = input.toLowerCase();
  const matches = groups.filter((g) => !q || g.toLowerCase().includes(q));
  return (
    <span className="wl-rel">
      <input className="wl-gi" type="text" value={input} placeholder="None" aria-label="Assign to group" title="Assign to group. Type to create new or select existing."
        onChange={(e) => { setInput(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) assign(input); }} />
      {open && (matches.length > 0 || input.trim()) && (
        <div className="wl-dd" role="menu" aria-label="Groups" style={{ left: 0, width: 160 }}>
          {matches.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (g) => <MenuItem key={g} onMouseDown={(e) => e.preventDefault()} onClick={() => assign(g)}>{g}</MenuItem>)}
          {input.trim() && !groups.some((g) => g.toLowerCase() === q) && <MenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => assign(input)}>+ Create &quot;{input}&quot;</MenuItem>}
        </div>
      )}
    </span>
  );
}

/** The Timing cells: how long an entry stays on after it fires (sticky), rests (cooldown) and waits (delay), in messages. */
export function Timing({ entry, onPatch }: { entry: LorebookEntry; onPatch: Patch }): JSX.Element {
  const cell = (key: "sticky" | "cooldown" | "delay", text: string): JSX.Element => (
    <span className="wl-tcell"><span>{text}</span><LoreNum className="wl-num" label={key === "cooldown" ? "Cooldown messages" : key === "sticky" ? "Sticky messages" : "Delay messages"} value={entry[key]} min={0} fallback={0} onChange={(n) => onPatch({ [key]: n })} /></span>
  );
  return <span className="grp">{cell("sticky", "Sticky")}{cell("cooldown", "Cool")}{cell("delay", "Delay")}</span>;
}

/** The Recursion choice: whether this entry's text can set off other entries, or waits for a later pass. */
export function Recursion({ entry, onPatch }: { entry: LorebookEntry; onPatch: Patch }): JSX.Element {
  return <Segmented label="Recursion" size="sm" value={recursionModeOf(entry)} onChange={(m: RecursionMode) => onPatch(recursionPatch(m, entry.delayUntilRecursion))} items={RECURSION_ITEMS} />;
}

export function Injection({ entry, groups, onPatch }: { entry: LorebookEntry; groups: readonly string[]; onPatch: Patch }): JSX.Element {
  return (
    <div>
      <div className="wl-sec"><span className="wl-lb">Injection</span><span className="r wl-lb"><LoreHelp title={TIPS.position[0]} text={TIPS.position[1]} /> Position</span></div>
      <div className="wl-pos"><PositionPicker entry={entry} onPatch={onPatch} /></div>
      <div className="wl-row3">
        <div><span className="wl-lb" title="Entry Timing. Control when and how often this entry can activate using sticky, cooldown, and delay settings.">Timing</span>
          <Timing entry={entry} onPatch={onPatch} /></div>
        <div><span className="wl-lb" title="Recursion Behavior. Control whether this entry's content can trigger other entries, creating chains of activations.">Recursion</span>
          <span className="grp"><Recursion entry={entry} onPatch={onPatch} /></span></div>
        <div><span className="wl-lb" title="Entry Groups. Group entries together so only one from the group activates per turn. Weights determine selection probability.">Group</span>
          <Group entry={entry} groups={groups} onPatch={onPatch} /></div>
      </div>
    </div>
  );
}

// -- side effects ----------------------------------------------------------------------------------

const EFFECT_TYPES: readonly { value: SideEffectType; label: string; description: string; icon: string }[] = [
  { value: "setvar", label: "Set", description: "Set variable to a value", icon: "=" },
  { value: "addvar", label: "Append", description: "Append text to variable", icon: "+" },
  { value: "incvar", label: "Increment", description: "Add number to variable", icon: "↑" },
  { value: "decvar", label: "Decrement", description: "Subtract from variable", icon: "↓" },
  { value: "delvar", label: "Delete", description: "Delete the variable", icon: "×" },
];

function EffectRow({ effect, onUpdate, onRemove }: { effect: EntrySideEffect; onUpdate(patch: Partial<EntrySideEffect>): void; onRemove(): void }): JSX.Element {
  const needsValue = effect.type === "setvar" || effect.type === "addvar";
  const needsAmount = effect.type === "incvar" || effect.type === "decvar";
  return (
    <div className="wl-fr">
      <select value={effect.type} aria-label="Effect type" title="Effect type. What operation to perform on the variable." onChange={(e) => onUpdate({ type: e.target.value as SideEffectType })}>
        {EFFECT_TYPES.map((t) => <option key={t.value} value={t.value} title={t.description}>{t.icon} {t.label}</option>)}
      </select>
      <span className="l"><span>var:</span><input className="v mono" type="text" value={effect.variable} placeholder="variable_name" aria-label="Variable name" title="Variable name. The variable to modify when entry triggers." onChange={(e) => onUpdate({ variable: e.target.value })} /></span>
      {needsValue && <span className="l"><span>=</span><input className="v" type="text" value={effect.value ?? ""} placeholder="value" aria-label="Value" title="Value. The value to set or append." onChange={(e) => onUpdate({ value: e.target.value })} /></span>}
      {needsAmount && <span className="l" style={{ flex: "none" }}><span>by:</span><LoreNum className="am" label="Amount" value={effect.amount ?? 1} fallback={1} onChange={(amount) => onUpdate({ amount })} /></span>}
      <select className="sc" value={effect.scope} aria-label="Scope" title="Scope. Local (this chat only) or Global (across all chats)." onChange={(e) => onUpdate({ scope: e.target.value as "local" | "global" })}>
        <option value="local">Local</option><option value="global">Global</option>
      </select>
      <IconButton variant="quiet" size="sm" data-part="scene.lore.effect-remove" label="Remove this side effect" title="Remove Side Effect. Delete this variable operation from the entry." icon="lucide:trash-2" onClick={onRemove} />
    </div>
  );
}

/** RoleCall's Side Effects: variable operations that run when the entry fires, over the scene's own variables (core/assembly/lore-effects.ts). */
export function SideEffects({ value, onChange }: { value: EntrySideEffects | null; onChange(next: EntrySideEffects | null): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const effects = value?.effects ?? [];
  const has = effects.length > 0;
  const base = (): EntrySideEffects => value ?? { effects: [], onlyOnFirstTrigger: false, clearOnDeactivate: false };
  const update = (i: number, patch: Partial<EntrySideEffect>): void => onChange({ ...base(), effects: effects.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  return (
    <div className="wl-fx">
      <div className="wl-fxh">
        <Disclosure data-part="scene.lore.side-effects" open={open || has} onClick={() => setOpen(!open)} leading={<Ic name="lucide:zap" size={16} />} label="Side Effects" summary={has ? effects.length : undefined} />
        <LoreHelp title="Side Effects" text="Modify variables when this entry triggers. Variables can be used in content with {{getvar::name}}. Local scope: the variable exists only in this chat. Global scope: it persists across all chats." />
        <Button size="sm" icon="lucide:plus" data-part="scene.lore.effect-add" aria-label="Add a new side effect" title="Add Side Effect. Add a variable operation that runs when this entry activates."
          onClick={() => { onChange({ ...base(), effects: [...effects, { type: "setvar", variable: "", value: "", scope: "local" }] }); setOpen(true); }}>Add Effect</Button>
      </div>
      {(open || has) && (
        <div className="wl-fxl">
          {effects.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (e, i) => <EffectRow key={i} effect={e} onUpdate={(p) => update(i, p)} onRemove={() => onChange(effects.length === 1 ? null : { ...base(), effects: effects.filter((_, j) => j !== i) })} />)}
          {!has && open && <div className="wl-fxe">No side effects configured.<small>Add effects to set variables when this entry triggers.</small></div>}
          {has && (
            <div className="wl-fxo">
              <label><input type="checkbox" checked={value?.onlyOnFirstTrigger ?? false} onChange={() => onChange({ ...base(), onlyOnFirstTrigger: !base().onlyOnFirstTrigger })} />Only on first trigger</label>
              <label><input type="checkbox" checked={value?.clearOnDeactivate ?? false} onChange={() => onChange({ ...base(), clearOnDeactivate: !base().clearOnDeactivate })} />Clear when deactivated</label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- cross-entry boosting --------------------------------------------------------------------------

/** RoleCall's Cross-Entry Boosting: when this entry fires, the listed entries of this book are likelier to (core/lore/engine/boosting.ts). */
export function CrossEntryBoost({ entry, candidates, onPatch }: { entry: LorebookEntry; candidates: readonly { id: string; title: string }[]; onPatch: Patch }): JSX.Element {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = entry.boostIds ?? [];
  const amount = entry.boostAmount ?? 0.2;
  const titleOf = new Map(candidates.map((c) => [c.id, c.title]));
  const add = (): void => {
    const target = resolveBoostTarget(input, candidates, entry.id, ids);
    if (!target.ok) return setError(target.error);
    // A first target with no amount yet takes the box's own 0.2, so what the box shows is what the engine adds.
    onPatch({ boostIds: [...ids, target.id], ...(entry.boostAmount ? {} : { boostAmount: amount }) });
    setInput("");
    setError(null);
  };
  return (
    <div>
      <div className="wl-lbl"><span className="wl-lb">Cross-Entry Boosting</span><LoreHelp title="Cross-Entry Boosting" text="When this entry triggers, boost the activation probability of other specified entries. Enter names of other entries to boost; the boost amount (0-1) is added to their probability." /><small>(optional)</small></div>
      <div className="wl-cf">
        <div className="wl-bst">
          <input type="text" list={`boost-${entry.id}`} value={input} placeholder="Entry name to boost..." aria-label="Entry name to boost" title="Enter the name of another entry to boost when this one triggers"
            onChange={(e) => { setInput(e.target.value); if (error) setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <datalist id={`boost-${entry.id}`}>{candidates.filter((c) => c.id !== entry.id && !ids.includes(c.id)).map((c) => <option key={c.id} value={c.title} />)}</datalist>
          <LoreNum className="am" label="Boost amount" float min={0} max={1} step={0.1} value={amount} fallback={0.2} onChange={(boostAmount) => onPatch({ boostAmount })} />
        </div>
        {ids.length > 0 && (
          <div className="tags">
            {ids.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (id, i) => (
              <span key={`${id}-${i}`} className="tag bst" title={titleOf.has(id) ? id : "This target is not an entry in this lorebook; remove it."}>
                {titleOf.get(id) ?? `${id} (not found)`}
                <IconButton variant="quiet" size="sm" label={`Remove ${titleOf.get(id) ?? id} from boost list`} title="Remove Boost Target. Remove this linked entry from the cross-entry boost list." icon={<span aria-hidden="true">&times;</span>} onClick={() => onPatch({ boostIds: ids.filter((_, j) => j !== i) })} />
              </span>
            ))}
          </div>
        )}
        {error && <p role="alert" className="err">{error}</p>}
        <p>When this entry triggers, boost probability of listed entries by {(amount * 100).toFixed(0)}%</p>
      </div>
    </div>
  );
}

// -- character filter ------------------------------------------------------------------------------

export function CharacterFilter({ entry, onPatch }: { entry: LorebookEntry; onPatch: Patch }): JSX.Element {
  const [input, setInput] = useState("");
  const f = entry.characterFilter;
  const mode = (isExclude: boolean): void => onPatch({ characterFilter: { names: f?.names ?? [], tags: f?.tags ?? [], isExclude } });
  const add = (): void => {
    const v = input.trim();
    if (!v || !f) return;
    const tag = v.startsWith("#");
    onPatch({ characterFilter: { ...f, names: tag ? f.names : [...f.names, v], tags: tag ? [...f.tags, v.slice(1)] : f.tags } });
    setInput("");
  };
  const chip = (text: string, key: string, remove: () => void, aria: string): JSX.Element => (
    <span key={key} className={`tag${f?.isExclude ? " ex" : ""}`}>{text}<IconButton variant="quiet" size="sm" label={aria} title="Remove Filter Item. Remove this character name or tag from the entry filter." icon={<span aria-hidden="true">&times;</span>} onClick={remove} /></span>
  );
  return (
    <div>
      <div>
        <div className="wl-lbl"><span className="wl-lb">Character Filter</span><LoreHelp title="Character Filter" text="Limit this entry to specific characters. Whitelist makes it only activate for listed characters; blacklist excludes them. Use #tag to match characters by tag instead of name." /><small>(optional)</small></div>
        <div className="wl-cf">
          <div className="modes">
            <Segmented label="Character filter mode" size="sm" value={f ? (f.isExclude ? "blacklist" : "whitelist") : "none"} items={FILTER_MODES}
              onChange={(m) => { if (m === "none") onPatch({ characterFilter: null }); else mode(m === "blacklist"); }} />
          </div>
          {f && (
            <>
              <input type="text" value={input} placeholder="Add character name or tag..." aria-label="Add character name or tag" title="Type a character name or #tag and press Enter"
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
              <div className="tags">
                {f.names.map((n, i) => chip(n, `n${i}`, () => onPatch({ characterFilter: { ...f, names: f.names.filter((_, j) => j !== i) } }), `Remove ${n} from character filter`))}
                {f.tags.map((t, i) => chip(`#${t}`, `t${i}`, () => onPatch({ characterFilter: { ...f, tags: f.tags.filter((_, j) => j !== i) } }), `Remove #${t} from character filter`))}
              </div>
              <p>Tip: Prefix with # for tags (e.g., #hero)</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
