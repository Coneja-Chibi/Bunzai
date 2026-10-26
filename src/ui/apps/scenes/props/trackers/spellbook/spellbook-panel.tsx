/**
 * The Spellbook panel (RoleCall SpellbookWingPanel.tsx:693-1652): a search box, the MP bar and any custom pools spells draw on, the All, Learned, Observed and
 * Theoretical tabs, the type and class chips, spell cards with a rarity stripe, a mastery bar and a cooldown veil, and under each: Cast (Invoke), Set Signature,
 * Edit, Refresh by the model and Delete; and "Add Spell" (name, guide, Generate). The rules are core/trackers/spellbook.ts. A cast pays out of the Stats tracker and
 * leaves a note that rides the next reply (RoleCall's spellCastInjection); the note waiting is shown and can be cancelled. Generate and Refresh propose a spell kept only
 * on Accept; Delete leaves an Undo.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { readResources } from "../../../../../../core/trackers/resources";
import { tokensOf } from "../../../../../../core/trackers/list";
import { TEMPLATES, applySpellbook, castSpell, liveSpells, masteryLabel, masteryOf, readSpellbook, spellbookLines, type EditPatch, type Spell, type SpellMade, type Template } from "../../../../../../core/trackers/spellbook";
import { Button } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Empty, Filters, ItemCard, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";
import { MASTERY_TONE, SpellDetail, TEMPLATE_ICON, TEMPLATE_NAME, TEMPLATE_TONE } from "./spell-detail";

const RARITY_TONE = { common: "var(--stage-mute)", uncommon: "var(--stage-ok)", rare: "var(--stage-link)", epic: "var(--stage-macro)", legendary: "var(--stage-warn)" } as const;
const STATUS_TONE = { learned: "var(--stage-ok)", observed: "var(--stage-warn)", theoretical: "var(--stage-mute)" } as const;
const STATUS_ICON: Readonly<Record<Spell["status"], IconName>> = { learned: "lucide:circle-check", observed: "lucide:eye", theoretical: "lucide:book-open" };
const ASK = { module: "spellbook" } as const;
type Tab = "all" | "learned" | "observed" | "theoretical";
type Kind = "all" | Template;
const KINDS: readonly Kind[] = ["all", ...TEMPLATES];
const LEVEL_TONE = (n: number): string => (n >= 7 ? "var(--stage-warn)" : n >= 4 ? "var(--stage-macro)" : "var(--stage-mute)");
const ACCENT = "var(--stage-var)";

function Preview({ s }: { s: SpellMade }): JSX.Element {
  return (
    <>
      <p><b>{s.name}</b> ({TEMPLATE_NAME[s.template]}, level {s.level}, {s.status}){s.manaCost !== undefined ? `, ${s.manaCost} mana` : ""}</p>
      <p>{s.description}</p>
      {s.class && <p className="it-note">{s.class}{s.element ? `, ${s.element}` : ""}</p>}
    </>
  );
}

export function SpellbookPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const host = { ctx, chat, ...(onChat ? { onChat } : {}) };
  const view = useTracker(host, "spellbook", readSpellbook);
  const stats = useTracker(host, "resources", readResources);
  const [tab, setTab] = useState<Tab>("all");
  const [kind, setKind] = useState<Kind>("all");
  const [cls, setCls] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [casting, setCasting] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const book = view.data;
  const tactical = book.subs["tacticalMode"] === true;
  const wild = book.subs["wildMagic"] === true;
  const spells = liveSpells(book);
  const counts = { all: spells.length, learned: spells.filter((s) => s.status === "learned").length, observed: spells.filter((s) => s.status === "observed").length, theoretical: spells.filter((s) => s.status === "theoretical").length };
  const classes = [...new Set(spells.flatMap((s) => (s.class ? [s.class] : [])))].sort();
  const q = query.trim().toLowerCase();
  const shown = spells
    .filter((s) => tab === "all" || s.status === tab)
    .filter((s) => kind === "all" || s.template === kind)
    .filter((s) => cls === "all" || s.class === cls)
    .filter((s) => q === "" || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || (s.class ?? "").toLowerCase().includes(q))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  const act = (action: Parameters<typeof applySpellbook>[1], undoLabel?: string): void => view.apply((d) => applySpellbook(d, action), undoLabel);
  const tellFor3s = (f: { id: string; ok: boolean; text: string }): void => {
    setFeedback(f);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 3000);
  };
  const cast = (spell: Spell): void => {
    const out = castSpell(book, stats.data, spell.id, { intent: intent.trim(), tactical, at: Date.now(), rand: Math.random, stamp: { now: Date.now(), id: () => `log-${crypto.randomUUID()}` } });
    if (!out.ok) { tellFor3s({ id: spell.id, ok: false, text: out.reason }); return; }
    if (out.resources !== stats.data) stats.apply(() => out.resources);
    view.apply(() => out.spellbook);
    tellFor3s({ id: spell.id, ok: true, text: out.message });
    setCasting(null);
    setIntent("");
  };
  const startEdit = (s: Spell): void => {
    setEditing(s.id);
    setDraft({ name: s.name, description: s.description, manaCost: s.manaCost === undefined ? "" : String(s.manaCost), narrativeCost: s.narrativeCost ?? "", castingRequirement: s.castingRequirement ?? "", emotionalAffinity: s.emotionalAffinity ?? "", wild: s.wildMagicSusceptibility === undefined ? "" : String(s.wildMagicSusceptibility) });
  };
  const saveEdit = (s: Spell): void => {
    const mana = draft["manaCost"] === "" || draft["manaCost"] === undefined ? undefined : Math.max(0, Number.parseInt(draft["manaCost"], 10) || 0);
    const w = draft["wild"] === "" || draft["wild"] === undefined ? undefined : Math.min(100, Math.max(0, Number.parseInt(draft["wild"], 10) || 0));
    const patch: EditPatch = { name: (draft["name"] ?? s.name).trim() || s.name, description: draft["description"] ?? s.description, manaCost: mana, narrativeCost: draft["narrativeCost"], castingRequirement: draft["castingRequirement"], emotionalAffinity: draft["emotionalAffinity"] };
    act({ kind: "edit", id: s.id, patch: wild ? { ...patch, wildMagicSusceptibility: w } : patch });
    setEditing(null);
  };
  const hasStats = chat.trackers?.resources?.data !== undefined;
  const r = stats.data;
  const needs = new Set(spells.flatMap((s) => (s.castingCost && !["mp", "hp", "ap"].includes(s.castingCost.resource) ? [s.castingCost.resource] : [])));
  const field = (key: string, label: string, type = "text", placeholder = ""): JSX.Element => (
    <label className="sp-field"><span>{label}</span><input type={type} value={draft[key] ?? ""} placeholder={placeholder} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>
  );
  const tabs = [{ id: "all", icon: "lucide:book-open", label: "All", count: counts.all }, { id: "learned", icon: "lucide:circle-check", label: "Learned", count: counts.learned }, { id: "observed", icon: "lucide:eye", label: "Observed", count: counts.observed }, { id: "theoretical", icon: "lucide:book", label: "Theoretical", count: counts.theoretical }] as const;
  return (
    <TrackerFrame label="Spellbook" title="Spellbook" icon="lucide:wand-sparkles" tone={ACCENT} tokens={tokensOf(spellbookLines(book))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks spells, mana costs, cooldowns, and cast history. Click spells to cast them with AI narration."
      onClear={() => view.apply((d) => ({ ...readSpellbook(undefined), subs: d.subs }), "Cleared")}>
      <div className="it-search"><span><Ic name="lucide:search" size={16} /></span><input type="text" placeholder="Search spells..." aria-label="Search spells" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {book.pendingCast !== undefined && (
        <div className="sp-pending" role="status"><span><Ic name="lucide:sparkles" size={14} /> A cast is waiting: your next message carries it to the narrator.</span><Button variant="quiet" size="sm" onClick={() => act({ kind: "clearPending" })}>Cancel cast</Button></div>
      )}
      {hasStats && r.maxMp > 0 && (
        <div className="sp-pool">
          <div><span style={{ color: "var(--stage-link)" }}><Ic name="lucide:droplet" size={14} /></span><div className="st-track thin" style={{ "--c": "var(--stage-link)" } as CSSProperties}><div style={{ width: `${Math.min(100, (r.mp / r.maxMp) * 100)}%` }} /></div><small>{r.mp}/{r.maxMp}</small></div>
          {[...needs].filter((k) => r.needs[k]).map((k) => (
            <div key={k}><span style={{ color: "var(--stage-warn)" }}><Ic name="lucide:flame" size={12} /></span><div className="st-track thin" style={{ "--c": "var(--stage-warn)" } as CSSProperties}><div style={{ width: `${Math.min(100, (r.needs[k]!.value / r.needs[k]!.maxValue) * 100)}%` }} /></div><small>{r.needs[k]!.label || k}: {r.needs[k]!.value}/{r.needs[k]!.maxValue}</small></div>
          ))}
        </div>
      )}
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
      <div className="st-body">
        <Filters<Kind> options={KINDS} value={kind} onChange={setKind} icons={TEMPLATE_ICON} />
        {classes.length > 0 && <Filters<string> options={["all", ...classes]} value={cls} onChange={setCls} />}
        {shown.length > 0 ? (
          <div className="it-list">
            {shown.map((s) => {
              const rare = s.rarity ? RARITY_TONE[s.rarity] : ACCENT;
              const mastery = masteryOf(s);
              const cooling = (s.cooldownRemaining ?? 0) > 0;
              const here = feedback?.id === s.id ? feedback : null;
              return (
                <ItemCard key={s.id} color={rare} mod={`${s.status === "observed" ? " observed" : ""}${s.status === "theoretical" ? " theory" : ""}`}
                  icon={<span style={{ color: TEMPLATE_TONE[s.template] }}><Ic name={TEMPLATE_ICON[s.template]} size={16} /></span>}
                  title={s.name}
                  chip={(
                    <>
                      {s.isSignature && <span style={{ color: "var(--stage-warn)" }} title="Signature spell"><Ic name="lucide:star" size={14} /></span>}
                      {s.level > 0 && <span className="it-tag soft" style={{ "--c": LEVEL_TONE(s.level) } as CSSProperties} title={`Power level ${s.level}: ${s.level >= 7 ? "Legendary power" : s.level >= 4 ? "Advanced" : "Basic"}`}>{"★".repeat(Math.min(s.level, 5))}{s.level > 5 ? `+${s.level - 5}` : ""}</span>}
                    </>
                  )}
                  meta={<>{s.class && <span className="it-line"><Ic name="lucide:shield" size={12} />{s.class}</span>}{s.status === "observed" && s.observedFrom && <em>Seen from {s.observedFrom}</em>}</>}
                  preview={s.description}
                  veil={cooling ? <><Ic name="lucide:clock" size={16} /><b>{s.cooldownRemaining} turns</b></> : null}
                  right={(
                    <div className="it-pillcol">
                      {s.rarity && <span className="it-tag" style={{ "--c": rare } as CSSProperties}>{s.rarity}</span>}
                      <span className="it-tag soft" style={{ "--c": STATUS_TONE[s.status] } as CSSProperties}><Ic name={STATUS_ICON[s.status]} size={12} />{s.status}</span>
                    </div>
                  )}
                  under={s.status === "learned" && mastery > 0 ? <div className="sp-mastery"><div><span style={{ color: MASTERY_TONE(mastery) }}>{masteryLabel(mastery)}</span><span>{mastery}%</span></div><div className="bd-bar"><div style={{ width: `${mastery}%`, background: MASTERY_TONE(mastery) }} /></div></div> : null}
                  open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)}>
                  <div className="it-actions">
                    {s.status === "learned" && (casting === s.id ? (
                      <div className="sp-cast">
                        <input type="text" placeholder="Your intent... (optional)" aria-label="Your intent" value={intent} onChange={(e) => setIntent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") cast(s); }} />
                        <div className="it-buttons">
                          <Button size="sm" icon={tactical ? "lucide:dice-5" : "lucide:sparkles"} disabled={cooling} onClick={() => cast(s)}>{tactical ? "Cast" : "Invoke"}</Button>
                          <Button variant="quiet" size="sm" onClick={() => { setCasting(null); setIntent(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : <Button size="sm" icon={tactical ? "lucide:dice-5" : "lucide:sparkles"} disabled={cooling} onClick={inner(() => setCasting(s.id))}>{tactical ? "Cast" : "Invoke"}</Button>)}
                    {s.status === "learned" && (
                      <Button size="sm" icon="lucide:star" aria-pressed={s.isSignature} title={s.isSignature ? "Remove signature" : "Set as signature spell (max 2)"} onClick={inner(() => act({ kind: s.isSignature ? "unsignature" : "signature", id: s.id }))}>{s.isSignature ? "Signature" : "Set Signature"}</Button>
                    )}
                    <Button size="sm" tone={editing === s.id ? "var(--stage-ok)" : undefined} icon={editing === s.id ? "lucide:check" : "lucide:pencil"} onClick={inner(() => (editing === s.id ? saveEdit(s) : startEdit(s)))}>{editing === s.id ? "Save" : "Edit"}</Button>
                    {editing === s.id && <Button variant="quiet" size="sm" icon="lucide:x" onClick={inner(() => setEditing(null))}>Cancel</Button>}
                    {cooling && <Button size="sm" icon="lucide:clock" title="Make this spell ready now" onClick={inner(() => act({ kind: "ready", id: s.id }))}>Ready now</Button>}
                    <span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete spell" onClick={inner(() => { act({ kind: "remove", id: s.id, at: Date.now() }, `Deleted ${s.name}`); setOpen(null); })}>Delete</Button></span>
                  </div>
                  <RefreshByModel<SpellMade> ctx={ctx} chatId={chat.id} ask={ASK} noun="spell" existing={s} preview={(m) => <Preview s={m} />} accept={(m) => act({ kind: "refresh", id: s.id, spell: m })} />
                  {here && <div className={`sp-feedback ${here.ok ? "ok" : "bad"}`} role="status">{here.text}</div>}
                  {editing === s.id ? (
                    <div className="it-fields">
                      {field("name", "Name")}
                      <label className="sp-field"><span>Description</span><textarea rows={3} value={draft["description"] ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
                      <div className="sp-two">{field("manaCost", "Mana Cost", "number", "0")}{field("narrativeCost", "Narrative Cost", "text", "e.g., tears, memory")}</div>
                      {field("castingRequirement", "Casting Requirement", "text", "e.g., Must be in moonlight")}
                      {field("emotionalAffinity", "Emotional Affinity", "text", "e.g., Hope, Rage, Sorrow")}
                      {wild && field("wild", "Wild Magic (0 to 100)", "number", "0")}
                    </div>
                  ) : <div><h5>Description</h5><p>{s.description}</p></div>}
                  <SpellDetail spell={s} tactical={tactical} />
                </ItemCard>
              );
            })}
          </div>
        ) : <Empty icon="lucide:wand-sparkles" title="No spells known" hint={query ? "No results found" : "Spells will be discovered as the story progresses"} />}
        {note && <p className="it-error" role="alert">{note}</p>}
        <AddByModel<SpellMade> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Spell" noun="spell" namePlaceholder="Spell name" guidePlaceholder="Guide the AI... (e.g., 'a fire attack spell')"
          preview={(m) => <Preview s={m} />}
          accept={(m) => { const action = { kind: "add", spell: m, id: `spell-${crypto.randomUUID()}` } as const; if (applySpellbook(book, action) === book) { setNote("The Spellbook is full, so it was not added."); return; } setNote(null); act(action); }} />
      </div>
    </TrackerFrame>
  );
}
