/**
 * The Prompting wing's parts (approved wireframe rc-port/scene-preset-wing.html): RoleCall's
 * CollapsibleSamplerBar, its prompt list (MiniPromptItem rows under category switches), and its
 * PromptEditPane. The switches and samplers are the scene's own; the text belongs to the preset.
 */
import { Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type KeyboardEvent, type ReactNode } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetBody, PresetPrompt, PresetSamplers } from "../../../entities/preset/schema";
import type { ChatPresetSamplers } from "../../../stage/contracts/chat-store";
import { DEFAULT_MAX_MESSAGES, estimateMessageWindow } from "../../../core/assembly/message-window";
import { countText } from "../../../core/tokens";
import { Ic, type IconName } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import {
  bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, useFocusedRangeIndex, useVirtualRows, type Range,
} from "../../_shared/virtual-list";
import { SamplerHistoryContext } from "./sampler-history";
import { selectedSwipe } from "./use-scene-swipe-preview";
import { formatSampler, groupsOf, isOn, markerLabel, onCount, type PromptGroup, type SamplerKey, type Toggles } from "./preset-core";
import { FullscreenLayer } from "./fullscreen-layer";
import { MacroPreview } from "./macro-preview";
import { SamplerCard } from "./scene-sampler-card";
import { LIST_WIDTH, parseSize } from "./size-core";
import { SplitGrip } from "./split-grip";
import { Disclosure, IconButton, Segmented, Tile, Toggle } from "../../components/button";

/** The viewer's own preferences (`ctx.prefs`): the sizes they drag are theirs, not the scene's. */
type Prefs = AppContext["prefs"];

type Samplers = ChatPresetSamplers;
/** Every value a preset may hold; the _tools twins run as their plain mode, since scenes send no tools. */
export const MERGE: readonly (readonly [NonNullable<PresetSamplers["promptPostProcessing"]>, string])[] = [
  ["none", "None (send as built)"],
  ["merge", "Merge same-role messages"],
  ["merge_tools", "Merge (keeping tools)"],
  ["semi", "Semi-strict"],
  ["semi_tools", "Semi-strict (keeping tools)"],
  ["strict", "Strict"],
  ["strict_tools", "Strict (keeping tools)"],
  ["single", "Single user message"],
  ["claude", "Claude (old SillyTavern mode; sends as built)"],
];
/** The short name the quick bar shows for each mode (RoleCall's POST_PROCESSING_LABELS, PresetPanel.tsx:2782). */
const MERGE_SHORT: Readonly<Record<string, string>> = {
  none: "None", merge: "Merge", merge_tools: "Merge+tools", semi: "Semi", semi_tools: "Semi+tools", strict: "Strict", strict_tools: "Strict+tools", single: "Single", claude: "Claude",
};
/** `unset` is where the handle rests when neither the preset nor the scene sets a value: what a provider does without one. `tone` and `help` are RoleCall's colour and "?" text for the card (PresetPanel.tsx:2600-2714). */
type Slider = { key: Exclude<SamplerKey, "promptPostProcessing" | "contextMode">; label: string; min: number; max: number; step: number; unset: number; tone: string; help: string };
export const SLIDERS: readonly Slider[] = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.01, unset: 1, tone: "var(--deck-regex)", help: "Controls randomness. Lower (0.0-0.7) = focused and predictable. Higher (0.8-2.0) = creative and varied. Use 0.7-1.0 for most conversations." },
  { key: "topP", label: "Top P", min: 0, max: 1, step: 0.01, unset: 1, tone: "var(--deck-persona)", help: "Limits word choices by probability. Lower (0.1-0.5) = safer, more common words. Higher (0.9-1.0) = wider vocabulary. Most use 0.9-0.95. Works with Temperature." },
  { key: "topK", label: "Top K", min: 0, max: 200, step: 1, unset: 0, tone: "var(--stage-ok)", help: "Limits word choices to top N candidates. Lower (10-40) = consistent style. Higher (60-100) = more variety. 0 = disabled. Often used with Top P. Try 40-60 for balanced results." },
  { key: "maxTokens", label: "Max Response Length", min: 16, max: 16_384, step: 16, unset: 8_192, tone: "var(--deck-lorebook)", help: "Maximum length of AI responses in tokens (~4 chars/token). Lower (256-1024) = concise replies. Higher (2048-8192) = detailed, lengthy responses. Doesn't affect your input limit." },
  { key: "maxContext", label: "Max Context", min: 1_024, max: 200_000, step: 1_024, unset: 200_000, tone: "var(--stage-warn)", help: "Maximum tokens the AI can 'see' at once, including system prompt, character info, chat history, and response. Never more than the model's own window: a larger value is cut to fit when the scene sends. Older messages are trimmed to fit this budget." },
  { key: "frequencyPenalty", label: "Frequency Penalty", min: -2, max: 2, step: 0.01, unset: 0, tone: "var(--stage-text-dim)", help: "Lowers the odds of a word in proportion to how often it has already appeared. Positive values cut repetition; negative values invite it." },
  { key: "presencePenalty", label: "Presence Penalty", min: -2, max: 2, step: 0.01, unset: 0, tone: "var(--stage-text-dim)", help: "Lowers the odds of any word that has appeared at all. Positive values push toward new topics; negative values stay on the current one." },
];
/** RoleCall's Max Messages slider (QuickPlayPanel.tsx:2025): shown instead of Max Context in messages mode. */
export const MAX_MESSAGES: Slider = { key: "maxMessages", label: "Max Messages", min: 0, max: 1_000, step: 1, unset: DEFAULT_MAX_MESSAGES, tone: "var(--stage-warn)", help: "Number of previous messages the AI sees. The current user message is always included on top of this count. Use when you want to cap by raw conversation depth instead of a token budget." };
const shown = (v: number | undefined, step?: number) => (v === undefined ? "-" : formatSampler(v, step));

/** The Control Booth's order and members (QuickPlayPanel.tsx:1928-2087): Temperature, Max Tokens, the Context card, then the rest. */
const QUICK_ORDER: readonly Slider["key"][] = ["temperature", "maxTokens", "maxContext", "topP", "topK", "frequencyPenalty", "presencePenalty"];

export function SamplerBar({ preset, own, onSet, booth = false }: {
  preset: PresetSamplers;
  own: Samplers;
  onSet<K extends SamplerKey>(key: K, value: Samplers[K]): void;
  /** The sliders alone, always open, as the Control Booth draws them (RoleCall's Generation (Quick)); the bar and the merge select are the Preset tab's. */
  booth?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [helpMerge, setHelpMerge] = useState(false);
  const history = useContext(SamplerHistoryContext);
  const value = <K extends SamplerKey>(k: K): Samplers[K] => (own[k] ?? preset[k]) as Samplers[K];
  const dot = (k: SamplerKey) => (own[k] !== undefined ? <i className="ov" title="This scene's own value" /> : null);
  const quick = (k: SamplerKey, label: string, tone: string, text: string) => (
    <span className="qv" style={{ "--c": tone } as CSSProperties}><span className="ql">{label}:</span><b>{text}</b>{dot(k)}</span>
  );
  const mode = value("contextMode") ?? "tokens";
  const card = (s: Slider, extra: { header?: ReactNode; footer?: ReactNode } = {}) => (
    <SamplerCard key={s.key} plain={booth} label={s.label} tone={s.tone} value={value(s.key)} unset={s.unset} min={s.min} max={s.max} step={s.step} help={s.help} own={own[s.key] !== undefined}
      back={shown(preset[s.key], s.step)} onBack={() => onSet(s.key, preset[s.key])} onSet={(v) => onSet(s.key, v)} {...extra} />
  );
  const estimate = (): ReactNode => {
    if (!history) return <span className="slf-n">estimating...</span>;
    const visible = history.messages.filter((m) => !m.cut && !m.hidden).map((m) => ({ role: m.role, content: selectedSwipe(m)?.content ?? "" }));
    if (visible.length === 0) return <span className="slf-n">~0 tokens (empty chat)</span>;
    const est = estimateMessageWindow(visible, { contextMode: "messages", maxMessages: value("maxMessages") }, countText);
    return <><i>~</i><b>{est.tokens.toLocaleString()} tokens</b><i>&middot;</i><span className="slf-n">{est.kept} of {history.total}</span></>;
  };
  const modeSwitch = (
    <div className="slm">
      <span>Context Mode</span>
      <Segmented label="Context Mode" size="sm" items={[{ value: "tokens", label: "Tokens" }, { value: "messages", label: "Messages" }]} value={mode} onChange={(m) => onSet("contextMode", m)} />
      {dot("contextMode")}
    </div>
  );
  const merge = value("promptPostProcessing") ?? "none";
  /** RoleCall's PostProcessingSelect (PresetPanel.tsx:2809-2857): the label with its dot and "?", the select, the help. The Booth keeps it as its last card. */
  const mergeCard = (
    <div className="sl" style={{ "--c": "var(--stage-link)" } as CSSProperties}>
      <div className="slh">
        <span className="slh-pp">Prompt Post-Processing{dot("promptPostProcessing")}
          <IconButton variant="quiet" size="sm" icon="lucide:circle-question-mark" label="Help" aria-expanded={helpMerge} onClick={() => setHelpMerge(!helpMerge)} />
        </span>
      </div>
      <select value={merge} onChange={(e) => onSet("promptPostProcessing", e.target.value as Samplers["promptPostProcessing"])} aria-label="Prompt Post-Processing">
        {MERGE.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      {helpMerge && <p className="slhelp">Controls how messages are formatted before sending to the AI. &quot;Merge&quot; fixes Claude alternation issues by combining consecutive same-role messages. &quot;Strict&quot; ensures user-first message order for APIs that require it.</p>}
    </div>
  );
  if (booth) {
    const label = (s: Slider): Slider => (s.key === "maxTokens" ? { ...s, label: "Max Tokens" } : s);
    return (
      <div className="sliders quick" data-part="scene.booth.sliders">
        {QUICK_ORDER.map((k) => SLIDERS.find((s) => s.key === k)!).map((s) => s.key !== "maxContext" ? card(label(s)) : (
          <div className="sl ctxcard" key={s.key}>
            {modeSwitch}
            {mode === "messages" ? card(MAX_MESSAGES, { footer: estimate() }) : card(s)}
          </div>
        ))}
        {mergeCard}
      </div>
    );
  }
  return (
    <div className="sbar">
      <Disclosure data-part="scene.preset.samplers" open={open} onClick={() => setOpen(!open)} label={
        <span className="sbar-vals">
          <span className="lbl">Samplers:</span>
          {quick("temperature", "Temp", "var(--deck-regex)", shown(value("temperature")))}
          {quick("topP", "Top P", "var(--deck-persona)", shown(value("topP")))}
          {quick("topK", "Top K", "var(--stage-ok)", shown(value("topK")))}
          {quick("maxTokens", "Response", "var(--deck-lorebook)", shown(value("maxTokens")))}
          {quick("maxContext", "Context", "var(--stage-warn)", shown(value("maxContext")))}
          {quick("promptPostProcessing", "Post", "var(--stage-link)", MERGE_SHORT[merge] ?? merge)}
        </span>} />
      {open && (
        <div className="sliders">
          {SLIDERS.map((s) => s.key !== "maxContext" ? card(s) : (
            <Fragment key={s.key}>
              {mode === "messages" ? card(MAX_MESSAGES, { header: modeSwitch, footer: estimate() }) : card(s, { header: modeSwitch })}
            </Fragment>
          ))}
          {mergeCard}
        </div>
      )}
    </div>
  );
}

const roleTag = (role: PresetPrompt["role"]): string =>
  role === "system" ? "SYS" : role === "user" ? "USR" : role === "assistant" ? "AST" : "TOOL";

/** One prompt row. Not memoized: the wing passes fresh toggle handlers each render, so a memo would
 * never bail. The list virtualizes instead, which bounds rows drawn to
 * the viewport. */
function PromptRow({ p, selected, on, own, onSelect, onToggle }: {
  p: PresetPrompt;
  selected: boolean;
  on: boolean;
  own: boolean;
  onSelect(id: string): void;
  onToggle(p: PresetPrompt, on: boolean): void;
}): JSX.Element {
  return (
    <div className={`pi${selected ? " sel" : ""}${on ? "" : " off"}`} onClick={() => onSelect(p.id)}>
      <Toggle size="sm" isolate on={on} aria-label={`${on ? "Turn off" : "Turn on"} ${p.name}`} onChange={(next) => onToggle(p, next)} />
      <div className="pn">
        <span>{p.name}{own && <i className="ov" title="This scene's own switch" />}</span>
        {p.marker ? <small className="mk">{markerLabel(p.markerSlot ?? p.id)} slot</small> : <small>~{countText(p.content)} tok</small>}
      </div>
      <span className={`role ${p.role}`} title={p.role}>{roleTag(p.role)}</span>
    </div>
  );
}

/** One virtual row: a category header or one prompt beneath it. */
type Row =
  | { kind: "header"; key: string; group: PromptGroup; list: PresetPrompt[] }
  | { kind: "prompt"; key: string; p: PresetPrompt; depth: number };

const HEADER_PX = 37;
const SUB_HEADER_PX = 33;
const PROMPT_PX = 50;
/** What a prompt looks like on the rail (PresetPanel.tsx:2184-2190): a system prompt, one placed in the history, or a plain one. */
const railIcon = (p: PresetPrompt): IconName => (p.systemPrompt ? "lucide:scroll-text" : p.placement === "in_chat" || p.placement === "append" ? "lucide:message-square" : "lucide:zap");

export function PromptList({ body, toggles, selected, templates, prefs, onSelect, onToggle, onToggleGroup }: {
  body: PresetBody;
  /** The Templates section, drawn at the top of the scrolling list; it takes the search text. */
  templates?(query: string): JSX.Element;
  toggles: Toggles;
  selected: string | null;
  /** Where the width the viewer drags the list to is kept. */
  prefs: Prefs;
  onSelect(id: string): void;
  onToggle(p: PresetPrompt, on: boolean): void;
  onToggleGroup(prompts: PresetPrompt[], on: boolean): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  /** Every group starts folded (RoleCall initialCategoriesCollapsed, PresetPanel.tsx:1235); the ones the viewer opened. A search opens what matches. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [folded, setFolded] = useState(false);
  const [width, setWidth] = useState(() => parseSize(LIST_WIDTH, prefs.get(LIST_WIDTH.key)));
  const rail = folded && selected !== null;
  const q = query.trim().toLowerCase();
  const match = useCallback(
    (p: PresetPrompt) => !q || p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
    [q],
  );
  const active = body.prompts.filter((p) => isOn(p, toggles) && !p.marker).reduce((n, p) => n + countText(p.content), 0);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const g of groupsOf(body)) {
      const key = g.id ?? "";
      const list = g.prompts.filter(match);
      if (list.length === 0 && q) continue;
      out.push({ kind: "header", key: `group:${key}`, group: g, list });
      if (opened.has(key) || q) for (const p of list) out.push({ kind: "prompt", key: p.id, p, depth: g.depth });
    }
    return out;
  }, [body, match, q, opened]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // The Templates section sits at the top of the scroller, above the sized spacer the rows are laid in: the
  // virtualizer is told how far down the rows begin (scrollMargin) so a row's offset stays its own.
  const headRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const head = headRef.current;
    if (!head) return;
    const read = (): void => setMargin(head.offsetHeight);
    read();
    const watch = new ResizeObserver(read);
    watch.observe(head);
    return () => watch.disconnect();
  }, [rail]);
  // C-1: a wheel/scrollbar scroll must not unmount the row holding focus, and Tab
  // off the last rendered row must reach the next real one - the same shared helpers the other 6
  // virtualized lists use, folded in here rather than reimplemented (dup-audit/ui.md item 9, B20).
  const flatIndexOfFocused = useCallback((target: HTMLElement) => {
    const at = target.closest<HTMLElement>("[data-index]")?.dataset["index"];
    return at === undefined ? -1 : Number(at);
  }, []);
  const identity = useCallback((flat: number) => flat, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, identity);
  const virtualizer = useVirtualRows({
    mode: "list",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (i) => rows[i]!.key,
    estimateSize: (i) => { const r = rows[i]!; return r.kind === "prompt" ? PROMPT_PX : r.group.depth > 0 ? SUB_HEADER_PX : HEADER_PX; },
    scrollMargin: margin,
    overscan: OVERSCAN,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const onListKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatIndexOfFocused(ev.target as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(ev, virtualizer, rows.length, flat, ev.currentTarget, (i) => rows[i]!.key);
  };

  return (
    <>
      <aside className={`side${rail ? " rail" : ""}`} style={{ "--side-w": `${String(width)}px` } as CSSProperties}>
        <div className="side-hd">
          {rail ? (
            <IconButton variant="quiet" size="sm" icon="lucide:chevron-right" label="Expand sidebar" onClick={() => setFolded(false)} />
          ) : (
            <>
              <span>Prompts</span>
              <span className="side-ct"><span>{onCount(body.prompts, toggles)}/{body.prompts.length}</span>
                {selected !== null && <IconButton variant="quiet" size="sm" icon="lucide:chevron-left" label="Collapse sidebar" onClick={() => setFolded(true)} />}
              </span>
            </>
          )}
        </div>
        {!rail && (
          <div className="sbw"><div className="sb"><Ic name="lucide:search" size={12} />
            <input value={query} placeholder="Search prompts..." aria-label="Search prompts" onChange={(e) => setQuery(e.target.value)} />
            {query && <IconButton variant="quiet" size="sm" icon="lucide:x" label="Clear search" onClick={() => setQuery("")} />}
          </div></div>
        )}
        {!rail && (
          <div className="side-list" ref={scrollRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
            <div ref={headRef}>{templates?.(query)}</div>
            {body.prompts.length === 0 && <div className="side-empty"><span><Ic name="lucide:sliders-horizontal" size={24} /></span><p>No prompts</p></div>}
            <div className="side-inner" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vRow) => {
                const row = rows[vRow.index];
                if (!row) return null;
                const style: CSSProperties = { transform: `translateY(${String(vRow.start - margin)}px)` };
                if (row.kind === "header") {
                  const g = row.group;
                  const key = g.id ?? "";
                  const on = row.list.filter((p) => isOn(p, toggles)).length;
                  const all = on === row.list.length && row.list.length > 0;
                  const open = opened.has(key) || !!q;
                  return (
                    <div key={row.key} ref={virtualizer.measureElement} data-index={vRow.index} data-pick={row.key} className="side-listrow" style={style}>
                      <div className={`cat${g.id ? " acc" : ""}${g.depth > 0 ? " sub" : ""}`} style={g.depth > 0 ? { marginLeft: 12 * g.depth } : undefined}>
                        <Toggle size="sm" on={all} mixed={!all && on > 0} aria-label={`${all ? "Turn off" : "Turn on"} everything in ${g.name}`} onChange={(next) => onToggleGroup(row.list, next)} />
                        <Disclosure data-part="scene.preset.category" open={open} label={g.name}
                          onClick={() => setOpened((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; })} />
                        <span className="cc">{on}/{row.list.length}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={row.key} ref={virtualizer.measureElement} data-index={vRow.index} data-pick={row.key} className="side-listrow" style={style}>
                    <div className={row.depth > 0 ? "ind" : undefined} style={row.depth > 0 ? { marginLeft: 12 * row.depth } : undefined}>
                      <PromptRow p={row.p} selected={selected === row.p.id} on={isOn(row.p, toggles)} own={typeof toggles[row.p.id] === "boolean"} onSelect={onSelect} onToggle={onToggle} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {rail && (
          <div className="side-rail">
            {body.prompts.map((p) => (
              <Tile key={p.id} kind="icon" icon={railIcon(p)} label={p.name} selected={selected === p.id} data-off={isOn(p, toggles) ? undefined : ""} onClick={() => onSelect(p.id)} />
            ))}
          </div>
        )}
        <div className="side-foot">
          <span>Active Prompts</span>
          <span title="Estimate from the raw prompt text. Macros, slots, chat history, and lore are not included; the trace shows what each send really cost.">~{active.toLocaleString()} tokens (estimate)</span>
        </div>
      </aside>
      {!rail && (
        <SplitGrip rule={LIST_WIDTH} size={width} grows="right" label="Resize prompt list" onLive={setWidth}
          onSave={(px) => { if (px === null) { setWidth(LIST_WIDTH.start); prefs.set(LIST_WIDTH.key, null); } else prefs.set(LIST_WIDTH.key, px); }} />
      )}
    </>
  );
}

const PLACE: Readonly<Record<string, string>> = {
  relative: "Before the history",
  in_chat: "In the history",
  append: "Added to a message",
  append_preset: "Pinned to the bottom",
  prepend_preset: "Pinned to the top",
};

/** One block's text. Typing saves to the preset after a pause (RoleCall saves after 500 ms). */
export function PromptEditor({ prompt, loadedAt, presetName, note, prefs, onText, onClose }: {
  prompt: PresetPrompt | null;
  /** Which load of the preset this editor shows; every text it hands up carries it. */
  loadedAt: number;
  presetName: string;
  note: { kind: "saved" | "stale" | "failed"; text: string } | null;
  prefs: Prefs;
  onText(id: string, text: string, loadedAt: number): void;
  /** Back to the list with nothing open. */
  onClose(): void;
}): JSX.Element {
  const [text, setText] = useState(prompt?.content ?? "");
  const [full, setFull] = useState(false);
  const saver = useDebouncedSave<{ id: string; text: string; at: number }>((p) => onText(p.id, p.text, p.at), 500);
  const flush = saver.flush;
  // Leaving a prompt saves what was typed rather than dropping it (RoleCall flushes too); closing the wing does the same.
  useEffect(() => flush, [prompt?.id, flush]);
  if (!prompt) return <section className="ed"><div className="ed-empty"><span><Ic name="lucide:sliders-horizontal" size={24} /></span><p>Select a prompt to edit</p><small>or toggle prompts on/off</small></div></section>;
  const depth = prompt.placement === "in_chat" || prompt.placement === "append" ? ` at depth ${prompt.injectionDepth}` : "";
  const editor = (
    <div className="ed-body">
      <div className="ed-hd">
        <span className="ed-l">
          <IconButton variant="quiet" size="sm" icon="lucide:chevron-left" label="Back" onClick={onClose} />
          <span className="nmx">{prompt.name}</span>
        </span>
        <span className="ed-r">
          <span className="tk">{prompt.marker ? "Marker" : `~${countText(text)} tok`}</span>
          <IconButton variant="quiet" size="sm" icon={full ? "lucide:minimize-2" : "lucide:maximize-2"} label={full ? "Exit fullscreen" : "Fullscreen"} onClick={() => setFull(!full)} />
        </span>
      </div>
      <div className="ed-main">
        <div className="ed-meta">
          <span className="chip">{prompt.role[0]!.toUpperCase() + prompt.role.slice(1)}</span>
          <span className="chip">{(PLACE[prompt.placement] ?? prompt.placement) + depth}</span>
          <span className="chip dim">Order {prompt.injectionOrder}</span>
        </div>
        {prompt.marker && !prompt.content ? (
          <div className="ed-marker"><b>Marker Prompt</b>: placeholder for {markerLabel(prompt.markerSlot ?? prompt.id)}. The scene fills it in when it sends. Write text here only to add to it.</div>
        ) : null}
        <textarea value={text} placeholder="Prompt content..." aria-label={`${prompt.name} text`} spellCheck={false} onChange={(e) => {
          setText(e.target.value);
          saver.push({ id: prompt.id, text: e.target.value, at: loadedAt });
        }} onBlur={flush} />
        <MacroPreview content={text} prefs={prefs} />
        {note ? (
          <div className={`ed-note${note.kind === "saved" ? "" : " warn"}`}><Ic name={note.kind === "saved" ? "lucide:check" : "lucide:triangle-alert"} size={14} />{note.text}</div>
        ) : (
          <div className="ed-note">Prompt text belongs to {presetName}: an edit here changes it for every scene that uses it. The switch beside it is this scene&apos;s alone.</div>
        )}
      </div>
    </div>
  );
  return <section className="ed">{full ? <FullscreenLayer label={`${prompt.name} text`}><div className="ed fs-ed">{editor}</div></FullscreenLayer> : editor}</section>;
}
