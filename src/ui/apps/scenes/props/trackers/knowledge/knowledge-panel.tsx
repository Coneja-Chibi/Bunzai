/**
 * The Knowledge panel (RoleCall KnowledgeWingPanel.tsx:493-997): a search box, the All, Certain, Uncertain and Secrets tabs with their counts, the category chips,
 * expandable entries with a reliability stripe, Refresh by the model, Delete, and "Add Knowledge Entry" (subject, guide, Generate). The rules are
 * core/trackers/knowledge.ts; this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh propose an entry that is kept
 * only on Accept; Delete leaves an Undo. Setting reliability and revealing the truth (set_reliability, reveal_truth) are the Story Director's and are not drawn;
 * an entry it has marked shows RoleCall's "Actually True" block.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { CATEGORIES, applyKnowledge, counts, knowledgeLines, liveEntries, readKnowledge, type KnowCategory, type KnowEntry, type Reliability } from "../../../../../../core/trackers/knowledge";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Button } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Chips, Empty, Filters, ItemCard, ItemList, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const TONE: Readonly<Record<Reliability, string>> = { certain: "var(--stage-ok)", believes: "var(--stage-link)", suspects: "var(--stage-warn)", uncertain: "var(--stage-mute)", wrong: "var(--stage-danger-text)", unknown: "var(--stage-line)" };
const MARKER: Readonly<Record<Reliability, string>> = { certain: "✓", believes: "~", suspects: "?", uncertain: "??", wrong: "x", unknown: "•" };
const LABEL: Readonly<Record<Reliability, string>> = { certain: "Certain", believes: "Believes", suspects: "Suspects", uncertain: "Uncertain", wrong: "Wrong", unknown: "Unknown" };
const CAT_ICON: Readonly<Record<KnowCategory, IconName>> = { person: "lucide:user", place: "lucide:map-pin", event: "lucide:calendar", secret: "lucide:lock", lore: "lucide:book", rumor: "lucide:message-circle", fact: "lucide:file-text" };
const CAT_LABEL: Readonly<Record<KnowCategory, string>> = { person: "Person", place: "Place", event: "Event", secret: "Secret", lore: "Lore", rumor: "Rumor", fact: "Fact" };
const DANGER: Readonly<Record<NonNullable<KnowEntry["dangerLevel"]>, string>> = { minor: "var(--stage-warn)", major: "color-mix(in srgb,var(--stage-warn) 60%,var(--stage-danger-text))", explosive: "var(--stage-danger-text)" };

type Tab = "all" | "certain" | "uncertain" | "secrets";
type Cat = "all" | KnowCategory;
const CAT_FILTERS: readonly Cat[] = ["all", ...CATEGORIES];
const ASK = { module: "knowledge" } as const;
type Made = Omit<KnowEntry, "id" | "learnedAt">;

function Preview({ entry }: { entry: Made }): JSX.Element {
  return (
    <>
      <p><b>{entry.subject}</b> ({LABEL[entry.reliability]}, {CAT_LABEL[entry.category]})</p>
      <p>{entry.content}</p>
      {entry.source && <p className="it-note">From: {entry.source}</p>}
      {entry.secretType && <p className="it-note">{entry.secretType === "player_hiding" ? "You hide this" : "Hidden from you"}{entry.dangerLevel ? `, ${entry.dangerLevel}` : ""}</p>}
    </>
  );
}

export function KnowledgePanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "knowledge", readKnowledge);
  const [tab, setTab] = useState<Tab>("all");
  const [cat, setCat] = useState<Cat>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const k = view.data;
  const c = counts(k);
  const act = (action: Parameters<typeof applyKnowledge>[1], undoLabel?: string): void => view.apply((d) => applyKnowledge(d, action), undoLabel);
  const q = query.trim().toLowerCase();
  const shown = liveEntries(k)
    .filter((e) => (tab === "certain" ? e.reliability === "certain" : tab === "uncertain" ? e.reliability !== "certain" : tab === "secrets" ? e.secretType !== undefined : true))
    .filter((e) => cat === "all" || e.category === cat)
    .filter((e) => q === "" || e.subject.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || (e.tags ?? []).some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => b.learnedAt - a.learnedAt);
  const accept = (entry: Made): void => {
    const action = { kind: "add", entry, id: `know-${crypto.randomUUID()}`, at: Date.now() } as const;
    if (applyKnowledge(k, action) === k) { setNote(liveEntries(k).length >= 300 ? "The Knowledge list is full, so it was not added." : "That is already in Knowledge."); return; }
    setNote(null);
    act(action);
  };
  const tabs = [
    { id: "all", icon: "lucide:book-open", label: "All", count: c.all }, { id: "certain", icon: "lucide:circle-check", label: "Certain", count: c.certain },
    { id: "uncertain", icon: "lucide:circle-question-mark", label: "Uncertain", count: c.all - c.certain }, { id: "secrets", icon: "lucide:lock", label: "Secrets", count: c.secrets },
  ] as const;
  return (
    <TrackerFrame label="Knowledge" title="Knowledge" icon="lucide:book-open" tone="color-mix(in srgb,var(--stage-link) 60%,var(--stage-ok))" tokens={tokensOf(knowledgeLines(k))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks what you know and have discovered to help the AI follow your character's knowledge. Generated replies can still make mistakes."
      onClear={() => view.apply((d) => ({ ...readKnowledge(undefined), subs: d.subs }), "Cleared")}
      badge={c.wrong > 0 ? <span className="it-pill bad">{c.wrong} WRONG</span> : null}>
      <div className="it-search"><span><Ic name="lucide:search" size={16} /></span><input type="text" placeholder="Search knowledge..." aria-label="Search knowledge" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
      <div className="st-body">
        <Filters<Cat> options={CAT_FILTERS} value={cat} onChange={setCat} icons={{ all: "lucide:layers", ...CAT_ICON }} />
        {shown.length > 0 ? (
          <ItemList items={shown} render={(e) => (
              <ItemCard color={TONE[e.reliability]} icon={<Ic name={CAT_ICON[e.category]} size={14} />} title={e.subject}
                meta={e.source ? <span className="it-line"><Ic name="lucide:user" size={12} />From: {e.source}</span> : null} preview={e.content}
                right={(
                  <div className="it-pillcol">
                    <span className="it-tag" style={{ "--c": TONE[e.reliability] } as CSSProperties}><span>{MARKER[e.reliability]}</span><span>{LABEL[e.reliability]}</span></span>
                    {e.dangerLevel && <span className="it-tag" style={{ "--c": DANGER[e.dangerLevel] } as CSSProperties}>{e.dangerLevel}</span>}
                    {e.secretType && <span className="it-tag soft" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>{e.secretType === "player_hiding" ? "You hide this" : "Hidden from you"}</span>}
                  </div>
                )}
                open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)}>
                <RefreshByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} noun="entry" existing={e} preview={(m) => <Preview entry={m} />} accept={(m) => act({ kind: "refresh", id: e.id, entry: m })}
                  extra={<span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete entry" onClick={inner(() => { act({ kind: "remove", id: e.id, at: Date.now() }, `Deleted ${e.subject}`); setOpen(null); })}>Delete</Button></span>} />
                <Block title="Knowledge"><p>{e.content}</p></Block>
                {e.actuallyTrue !== undefined && (
                  <div className="it-box" style={{ "--c": e.actuallyTrue ? "var(--stage-ok)" : "var(--stage-danger-text)" } as CSSProperties}>
                    <b><Ic name={e.actuallyTrue ? "lucide:circle-check" : "lucide:circle-x"} size={16} />{e.actuallyTrue ? "Actually True" : "Actually False"}</b>
                    {e.dmNotes && <em>{e.dmNotes}</em>}
                  </div>
                )}
                <div className="it-line"><Ic name="lucide:tag" size={14} /><span>Category: {CAT_LABEL[e.category]}</span></div>
                <Chips items={e.tags ?? []} />
                {e.linkedNpcNames && e.linkedNpcNames.length > 0 && <Block title="Related NPCs"><Chips items={e.linkedNpcNames} /></Block>}
                {e.secretType && (
                  <div className="it-box" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>
                    <b><Ic name="lucide:lock" size={14} />Secret Details</b>
                    {e.hiddenFrom && e.hiddenFrom.length > 0 && <div><small>Hidden from:</small><Chips items={e.hiddenFrom} /></div>}
                    {e.concealmentMethod && <div><small>Concealment method:</small><div>{e.concealmentMethod}</div></div>}
                    {e.vulnerabilityPoints && e.vulnerabilityPoints.length > 0 && <div><small>Vulnerability points:</small><ul>{e.vulnerabilityPoints.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (p, i) => <li key={`${p}${i}`}>{p}</li>)}</ul></div>}
                    {e.revelationImpact && <div><small>If revealed:</small><em>{e.revelationImpact}</em></div>}
                  </div>
                )}
                <div className="it-fine">{e.learnedFrom && <div>Learned from: {e.learnedFrom}</div>}<div>Learned: {new Date(e.learnedAt).toLocaleString()}</div></div>
              </ItemCard>
            )} />
        ) : (
          <Empty icon={tab === "secrets" ? "lucide:lock" : "lucide:book-open"} title={tab === "secrets" ? "No secrets tracked" : "No knowledge entries"}
            hint={tab === "secrets" ? "Enable the Secrets sub-toggle to track concealed information" : query ? "No results found" : "Your knowledge base is empty"} />
        )}
        {note && <p className="it-error" role="alert">{note}</p>}
        <AddByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Knowledge Entry" noun="entry" namePlaceholder="Subject" guidePlaceholder="Guide the AI... (e.g., 'a rumor about the king')"
          preview={(m) => <Preview entry={m} />} accept={(m) => accept(m)} />
      </div>
    </TrackerFrame>
  );
}
