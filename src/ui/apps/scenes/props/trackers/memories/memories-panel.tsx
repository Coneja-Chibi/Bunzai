/**
 * The Memories panel (RoleCall MemoryJournalWingPanel.tsx:320-828): the NPC chips with their counts, the All, Defining, Positive and Negative tabs, memory cards with a
 * category stripe, weight and sentiment tags, Refresh by the model and Delete, and "Add Memory" (NPC name, guide, Generate). The rules are core/trackers/memories.ts;
 * this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh propose a memory kept only on Accept; Delete leaves an Undo.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { tokensOf } from "../../../../../../core/trackers/list";
import { applyMemories, liveMemories, memoriesLines, npcNames, readMemories, titleOf, type Mem } from "../../../../../../core/trackers/memories";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Empty, ItemCard, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const CAT_TONE = { interaction: "var(--stage-link)", promise: "var(--stage-ok)", betrayal: "var(--stage-danger-text)", gift: "var(--stage-warn)", shared_experience: "var(--stage-macro)", observation: "var(--stage-mute)" } as const;
const CAT_ICON: Readonly<Record<Mem["category"], IconName>> = { interaction: "lucide:message-square", promise: "lucide:handshake", betrayal: "lucide:shield-off", gift: "lucide:gift", shared_experience: "lucide:users", observation: "lucide:eye" };
const CAT_NAME: Readonly<Record<Mem["category"], string>> = { interaction: "Interaction", promise: "Promise", betrayal: "Betrayal", gift: "Gift", shared_experience: "Shared Experience", observation: "Observation" };
const WEIGHT_TONE = { trivial: "var(--stage-mute)", minor: "var(--stage-link)", significant: "var(--stage-warn)", defining: "var(--stage-danger-text)" } as const;
const WEIGHT_ICON: Readonly<Record<Mem["emotionalWeight"], IconName>> = { trivial: "lucide:circle", minor: "lucide:circle-dot", significant: "lucide:star", defining: "lucide:flame" };
const WEIGHT_NAME: Readonly<Record<Mem["emotionalWeight"], string>> = { trivial: "Trivial", minor: "Minor", significant: "Significant", defining: "Defining" };
const SENT_TONE = { positive: "var(--stage-ok)", negative: "var(--stage-danger-text)", neutral: "var(--stage-mute)", complex: "var(--stage-macro)" } as const;
const SENT_ICON: Readonly<Record<Mem["sentiment"], IconName>> = { positive: "lucide:smile", negative: "lucide:frown", neutral: "lucide:circle-minus", complex: "lucide:scan" };
const ASK = { module: "memories" } as const;
type Tab = "all" | "defining" | "positive" | "negative";
const body = (content: string): string => (content.includes(": ") ? content.slice(content.indexOf(": ") + 2) : content);

function Tag({ tone, icon, children }: { tone: string; icon: IconName; children: string }): JSX.Element {
  return <span className="it-tag soft" style={{ "--c": tone } as CSSProperties}><Ic name={icon} size={12} />{children}</span>;
}
function Preview({ m }: { m: Mem }): JSX.Element {
  return <><p><b>{m.npcName}</b> ({CAT_NAME[m.category]}, {WEIGHT_NAME[m.emotionalWeight]}, {m.sentiment})</p><p>{m.content}</p></>;
}

export function MemoriesPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "memories", readMemories);
  const [tab, setTab] = useState<Tab>("all");
  const [npc, setNpc] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const j = view.data;
  const all = liveMemories(j);
  const mine = npc === null ? all : all.filter((m) => m.npcName.toLowerCase() === npc.toLowerCase());
  const count = { all: mine.length, defining: mine.filter((m) => m.emotionalWeight === "defining").length, positive: mine.filter((m) => m.sentiment === "positive").length, negative: mine.filter((m) => m.sentiment === "negative").length };
  const shown = mine.filter((m) => (tab === "defining" ? m.emotionalWeight === "defining" : tab === "positive" ? m.sentiment === "positive" : tab === "negative" ? m.sentiment === "negative" : true)).sort((a, b) => b.timestamp - a.timestamp);
  const act = (action: Parameters<typeof applyMemories>[1], undoLabel?: string): void => view.apply((d) => applyMemories(d, action), undoLabel);
  const tabs = [{ id: "all", icon: "lucide:brain", label: "All", count: count.all }, { id: "defining", icon: "lucide:star", label: "Defining", count: count.defining }, { id: "positive", icon: "lucide:heart", label: "Positive", count: count.positive }, { id: "negative", icon: "lucide:frown", label: "Negative", count: count.negative }] as const;
  return (
    <TrackerFrame label="Memories" title="Memory Journal" icon="lucide:brain" tone="color-mix(in srgb,var(--stage-danger-text) 50%,var(--stage-macro))" tokens={tokensOf(memoriesLines(j))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks per-NPC memories and shared experiences. The AI uses these for emotionally consistent callbacks."
      onClear={() => view.apply(() => readMemories(undefined), "Cleared")}>
      <div className="it-search">
        <div className="it-filters" role="group" aria-label="NPC" style={{ paddingBottom: 0 }}>
          <button type="button" className={npc === null ? "on" : ""} aria-pressed={npc === null} onClick={() => setNpc(null)}><Ic name="lucide:users" size={14} /><span>All NPCs</span><span className="it-count">{all.length}</span></button>
          {npcNames(j).map((n) => (
            <button key={n} type="button" className={npc === n ? "on" : ""} aria-pressed={npc === n} onClick={() => setNpc(n)}><Ic name="lucide:user" size={14} /><span>{n}</span><span className="it-count">{all.filter((m) => m.npcName === n).length}</span></button>
          ))}
        </div>
      </div>
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
      <div className="st-body">
        {shown.length > 0 ? (
          <div className="it-list">
            {shown.map((m) => (
              <ItemCard key={m.id} color={CAT_TONE[m.category]} icon={<Ic name={CAT_ICON[m.category]} size={14} />} title={m.content.includes(": ") ? titleOf(m.content) : CAT_NAME[m.category]}
                meta={<>{m.content.includes(": ") && <span className="it-line">{CAT_NAME[m.category]}</span>}{npc === null && <span className="it-line"><Ic name="lucide:user" size={12} />{m.npcName}</span>}</>}
                preview={body(m.content)}
                right={<div className="it-pillcol"><Tag tone={WEIGHT_TONE[m.emotionalWeight]} icon={WEIGHT_ICON[m.emotionalWeight]}>{WEIGHT_NAME[m.emotionalWeight]}</Tag><Tag tone={SENT_TONE[m.sentiment]} icon={SENT_ICON[m.sentiment]}>{m.sentiment}</Tag></div>}
                open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)}>
                <RefreshByModel<Mem> ctx={ctx} chatId={chat.id} ask={ASK} noun="memory" existing={m} preview={(x) => <Preview m={x} />} accept={(x) => act({ kind: "refresh", id: m.id, memory: x })}
                  extra={<button type="button" {...protect("tracker-delete", "it-act bad")} title="Delete memory" onClick={inner(() => { act({ kind: "remove", id: m.id, at: Date.now() }, "Deleted the memory"); setOpen(null); })}><Ic name="lucide:trash-2" size={14} /><span>Delete</span></button>} />
                <Block title="Memory"><p>{body(m.content)}</p></Block>
                {m.linkedEventDescription && <div className="it-box" style={{ "--c": "var(--stage-link)" } as CSSProperties}><b><Ic name="lucide:calendar" size={14} />Linked Event</b><p>{m.linkedEventDescription}</p></div>}
                <div className="it-chips">
                  <Tag tone={CAT_TONE[m.category]} icon={CAT_ICON[m.category]}>{CAT_NAME[m.category]}</Tag>
                  <Tag tone={WEIGHT_TONE[m.emotionalWeight]} icon={WEIGHT_ICON[m.emotionalWeight]}>{WEIGHT_NAME[m.emotionalWeight]}</Tag>
                  <Tag tone={SENT_TONE[m.sentiment]} icon={SENT_ICON[m.sentiment]}>{m.sentiment}</Tag>
                </div>
                <div className="it-fine"><div>Formed: {new Date(m.timestamp).toLocaleString()}</div></div>
              </ItemCard>
            ))}
          </div>
        ) : <Empty icon="lucide:brain" title="No memories recorded" hint="NPC memories will form as the story progresses" />}
        {note && <p className="it-error" role="alert">{note}</p>}
        <AddByModel<Mem> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Memory" noun="memory" namePlaceholder="NPC name" guidePlaceholder="Guide the AI... (e.g., 'a childhood trauma')"
          preview={(x) => <Preview m={x} />}
          accept={(x) => { const action = { kind: "add", memory: x, id: `mem-${crypto.randomUUID()}`, at: Date.now() } as const; if (applyMemories(j, action) === j) { setNote("The journal is full, so it was not added."); return; } setNote(null); act(action); }} />
      </div>
    </TrackerFrame>
  );
}
