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
import { Ic, type IconName } from "../../_shared/ic";
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

function Card({ pos, entry, label, tip, cls, onPatch }: { pos: InjectionPosition; entry: LorebookEntry; label: string; tip: readonly [string, string]; cls?: string; onPatch: Patch }): JSX.Element {
  return <button type="button" className={`wl-pc${cls ? ` ${cls}` : ""}${entry.position === pos ? " on" : ""}`} title={`${tip[0]}. ${tip[1]}`} onClick={() => onPatch({ position: pos })}>{label}</button>;
}

/** The @ Depth and Append cards: a plain button until chosen, then the depth and the role to place it as. */
function DepthCard({ pos, entry, icon, label, tip, cls, onPatch }: { pos: "depth" | "append"; entry: LorebookEntry; icon: IconName; label: string; tip: readonly [string, string]; cls: string; onPatch: Patch }): JSX.Element {
  if (entry.position !== pos) {
    return <button type="button" className={`wl-pc ${cls}`} title={`${tip[0]}. ${tip[1]}`} onClick={() => onPatch({ position: pos })}><Ic name={icon} size={14} />{label}</button>;
  }
  return (
    <div className={`wl-pc ${cls} on`} title={`${tip[0]}. ${tip[1]}`}>
      <Ic name={icon} size={14} />
      <LoreNum className="" label={pos === "depth" ? "Injection depth" : "Append depth"} value={entry.depth} min={0} fallback={pos === "depth" ? 4 : 0} onChange={(depth) => onPatch({ depth })} />
      <select value={entry.role} aria-label="Injection role" onChange={(e) => onPatch({ role: e.target.value as MessageRole })}>
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    </div>
  );
}

function Group({ entry, groups, onPatch }: { entry: LorebookEntry; groups: readonly string[]; onPatch: Patch }): JSX.Element {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const assign = (name: string): void => { onPatch({ groupName: name.trim(), groupWeight: 100 }); setInput(""); setOpen(false); };
  if (entry.groupName) {
    return (
      <span className="wl-gp">{entry.groupName}<span aria-hidden="true">&times;</span>
        <LoreNum label="Group weight" value={entry.groupWeight} fallback={100} onChange={(groupWeight) => onPatch({ groupWeight })} />
        <button type="button" aria-label="Remove from group" title="Remove From Group. Clears this entry group assignment and resets its group weight." onClick={() => onPatch({ groupName: null, groupWeight: 100 })}>&times;</button>
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
        <div className="wl-dd" style={{ left: 0, width: 160 }}>
          {matches.map((g) => <button type="button" key={g} onMouseDown={(e) => e.preventDefault()} onClick={() => assign(g)}>{g}</button>)}
          {input.trim() && !groups.some((g) => g.toLowerCase() === q) && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => assign(input)}>+ Create &quot;{input}&quot;</button>}
        </div>
      )}
    </span>
  );
}

export function Injection({ entry, groups, onPatch }: { entry: LorebookEntry; groups: readonly string[]; onPatch: Patch }): JSX.Element {
  const mode = recursionModeOf(entry);
  const recursion = (m: RecursionMode): void => onPatch(recursionPatch(m, entry.delayUntilRecursion));
  const timing = (key: "sticky" | "cooldown" | "delay", text: string): JSX.Element => (
    <span className="wl-tcell"><span>{text}</span><LoreNum className="wl-num" label={key === "cooldown" ? "Cooldown messages" : key === "sticky" ? "Sticky messages" : "Delay messages"} value={entry[key]} min={0} fallback={0} onChange={(n) => onPatch({ [key]: n })} /></span>
  );
  return (
    <div>
      <div className="wl-sec"><span className="wl-lb">Injection</span><span className="r wl-lb"><LoreHelp title={TIPS.position[0]} text={TIPS.position[1]} /> Position</span></div>
      <div className="wl-pos">
        <Card pos="world" entry={entry} label="World" tip={TIPS.world} onPatch={onPatch} />
        <Card pos="character" entry={entry} label="Character" tip={TIPS.character} onPatch={onPatch} />
        <Card pos="scene" entry={entry} label="Scene" tip={TIPS.scene} onPatch={onPatch} />
        <DepthCard pos="depth" entry={entry} icon="lucide:map-pin" label="@ Depth" tip={TIPS.depth} cls="dp" onPatch={onPatch} />
        <DepthCard pos="append" entry={entry} icon="lucide:corner-down-right" label="Append" tip={TIPS.append} cls="ap am" onPatch={onPatch} />
        <button type="button" className={`wl-pc pn am${entry.position === "prepend_top" ? " on" : ""}`} title={`${TIPS.top[0]}. ${TIPS.top[1]}`} onClick={() => onPatch({ position: "prepend_top" })}><Ic name="lucide:arrow-up-to-line" size={14} />Top</button>
        <button type="button" className={`wl-pc pn am${entry.position === "append_bottom" ? " on" : ""}`} title={`${TIPS.bottom[0]}. ${TIPS.bottom[1]}`} onClick={() => onPatch({ position: "append_bottom" })}><Ic name="lucide:arrow-down-to-line" size={14} />Bottom</button>
      </div>
      <div className="wl-row3">
        <div><span className="wl-lb" title="Entry Timing. Control when and how often this entry can activate using sticky, cooldown, and delay settings.">Timing</span>
          <span className="grp">{timing("sticky", "Sticky")}{timing("cooldown", "Cool")}{timing("delay", "Delay")}</span></div>
        <div><span className="wl-lb" title="Recursion Behavior. Control whether this entry's content can trigger other entries, creating chains of activations.">Recursion</span>
          <span className="grp">
            <button type="button" className={`wl-rc g${mode === "normal" ? " on" : ""}`} title="Normal Recursion. This entry's content is scanned for other entries' triggers, potentially activating them." onClick={() => recursion("normal")}>Normal</button>
            <button type="button" className={`wl-rc v${mode === "prevent" ? " on" : ""}`} title="Prevent Recursion. This entry's content will NOT trigger other entries." onClick={() => recursion("prevent")}>Prevent</button>
            <button type="button" className={`wl-rc b${mode === "delay" ? " on" : ""}`} title="Delay Until Recursion. This entry only activates on a later pass of scanning, after other entries have been processed." onClick={() => recursion("delay")}>Delay</button>
          </span></div>
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
      <button type="button" className="rm" aria-label="Remove this side effect" title="Remove Side Effect. Delete this variable operation from the entry." onClick={onRemove}><Ic name="lucide:trash-2" size={14} /></button>
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
        <button type="button" aria-expanded={open || has} onClick={() => setOpen(!open)}>
          <span className="z"><Ic name="lucide:zap" size={16} /></span><span className="wl-lb">Side Effects</span>
          {has && <span className="n">{effects.length}</span>}
          <span className={`cv${open ? " open" : ""}`}><Ic name="lucide:chevron-down" size={16} /></span>
        </button>
        <LoreHelp title="Side Effects" text="Modify variables when this entry triggers. Variables can be used in content with {{getvar::name}}. Local scope: the variable exists only in this chat. Global scope: it persists across all chats." />
        <button type="button" className="wl-ae" aria-label="Add a new side effect" title="Add Side Effect. Add a variable operation that runs when this entry activates."
          onClick={() => { onChange({ ...base(), effects: [...effects, { type: "setvar", variable: "", value: "", scope: "local" }] }); setOpen(true); }}><Ic name="lucide:plus" size={14} />Add Effect</button>
      </div>
      {(open || has) && (
        <div className="wl-fxl">
          {effects.map((e, i) => <EffectRow key={i} effect={e} onUpdate={(p) => update(i, p)} onRemove={() => onChange(effects.length === 1 ? null : { ...base(), effects: effects.filter((_, j) => j !== i) })} />)}
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
            {ids.map((id, i) => (
              <span key={`${id}-${i}`} className="tag bst" title={titleOf.has(id) ? id : "This target is not an entry in this lorebook; remove it."}>
                {titleOf.get(id) ?? `${id} (not found)`}
                <button type="button" aria-label={`Remove ${titleOf.get(id) ?? id} from boost list`} title="Remove Boost Target. Remove this linked entry from the cross-entry boost list." onClick={() => onPatch({ boostIds: ids.filter((_, j) => j !== i) })}>&times;</button>
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
    <span key={key} className={`tag${f?.isExclude ? " ex" : ""}`}>{text}<button type="button" aria-label={aria} title="Remove Filter Item. Remove this character name or tag from the entry filter." onClick={remove}>&times;</button></span>
  );
  return (
    <div>
      <div>
        <div className="wl-lbl"><span className="wl-lb">Character Filter</span><LoreHelp title="Character Filter" text="Limit this entry to specific characters. Whitelist makes it only activate for listed characters; blacklist excludes them. Use #tag to match characters by tag instead of name." /><small>(optional)</small></div>
        <div className="wl-cf">
          <div className="modes">
            <button type="button" className={`wl-wh${f && !f.isExclude ? " on" : ""}`} onClick={() => mode(false)}>Whitelist</button>
            <button type="button" className={`wl-bl2${f?.isExclude ? " on" : ""}`} onClick={() => mode(true)}>Blacklist</button>
            <button type="button" className={`wl-no${f ? "" : " on"}`} onClick={() => onPatch({ characterFilter: null })}>None</button>
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
