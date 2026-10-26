/**
 * The Corruption panel (RoleCall CorruptionWingPanel.tsx:291-790): the overall state, then the Player, NPCs, Effects and History tabs. Each player metric has -5 and +5
 * buttons and a bar marked at its thresholds; NPCs are cards with the same five metrics, Refresh by the model and Delete, and "Add NPC" (name, guide, Generate). The
 * rules are core/trackers/corruption.ts; this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh propose an entry kept only
 * on Accept; Delete leaves an Undo.
 */
import { useState, type CSSProperties, type JSX } from "react";
import {
  LEVEL_LABEL, METRICS, METRIC_NAMES, THRESHOLDS, activeEffects, applyCorruption, corruptionLines, dominantMetric, effectsFor, liveNpcs, overallLevel, readCorruption,
  type Level, type Metric, type Npc,
} from "../../../../../../core/trackers/corruption";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Button } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Chips, Empty, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const LEVEL_TONE: Readonly<Record<Level, string>> = { pure: "var(--stage-ok)", tainted: "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-warn))", corrupted: "var(--stage-warn)", fallen: "var(--stage-danger-text)", lost: "var(--stage-macro)" };
const METRIC_ICON: Readonly<Record<Metric, IconName>> = { corruption: "lucide:flame", submission: "lucide:arrow-down-to-line", dependence: "lucide:link", obsession: "lucide:eye", identityLoss: "lucide:ghost" };
const metricTone = (v: number): string => (v >= 75 ? "var(--stage-macro)" : v >= 50 ? "var(--stage-danger-text)" : v >= 25 ? "var(--stage-warn)" : v > 0 ? "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-warn))" : "var(--stage-ok)");
const ASK = { module: "corruption" } as const;
type Tab = "metrics" | "npcs" | "effects" | "history";
const TABS = [{ id: "metrics", icon: "lucide:gauge", label: "Player" }, { id: "npcs", icon: "lucide:users", label: "NPCs" }, { id: "effects", icon: "lucide:zap", label: "Effects" }, { id: "history", icon: "lucide:history", label: "History" }] as const;
type Made = Omit<Npc, "id" | "removedAt">;

function Preview({ n }: { n: Made }): JSX.Element {
  return (
    <>
      <p><b>{n.npcName}</b>: {METRICS.map((m) => `${m} ${n[m]}`).join(", ")}</p>
      <p className="it-note">Cause: {n.cause}</p>
      <Chips items={n.effects ?? []} />
      {n.description && <p>{n.description}</p>}
    </>
  );
}

function Pm({ onMinus, onPlus, label }: { onMinus(): void; onPlus(): void; label: string }): JSX.Element {
  return (
    <>
      <Button size="sm" tone="var(--stage-ok)" aria-label={`Lower ${label} by 5`} onClick={onMinus}>-5</Button>
      <Button size="sm" tone="var(--stage-danger-text)" aria-label={`Raise ${label} by 5`} onClick={onPlus}>+5</Button>
    </>
  );
}

export function CorruptionPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "corruption", readCorruption);
  const [tab, setTab] = useState<Tab>("metrics");
  const c = view.data;
  const level = overallLevel(c.values);
  const dominant = dominantMetric(c.values);
  const npcs = liveNpcs(c);
  const effects = activeEffects(c.values);
  const act = (action: Parameters<typeof applyCorruption>[1], undoLabel?: string): void => view.apply((d) => applyCorruption(d, action), undoLabel);
  const nudge = (metric: Metric, delta: number): void => act({ kind: "change", metric, delta, at: Date.now(), id: `clog-${crypto.randomUUID()}` });
  return (
    <TrackerFrame label="Corruption" title="Corruption" icon="lucide:skull" tone="var(--stage-macro)" tokens={tokensOf(corruptionLines(c))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks corruption, submission, dependence, and identity loss metrics. The AI escalates or resists based on these values."
      onClear={() => view.apply(() => readCorruption(undefined), "Cleared")}
      badge={level !== "pure" ? <span className="it-pill" style={{ "--w": LEVEL_TONE[level] } as CSSProperties}>{LEVEL_LABEL[level].toUpperCase()}</span> : null}>
      <div className="it-sum cr-over">
        <div className="cr-state"><small>Overall State</small><b style={{ color: LEVEL_TONE[level] }}>{LEVEL_LABEL[level].toUpperCase()}</b></div>
        {dominant && <div className="it-line"><Ic name={METRIC_ICON[dominant]} size={14} /><span>Dominated by <b className="cap">{dominant}</b></span></div>}
      </div>
      <Tabs<Tab> tabs={TABS} value={tab} onChange={setTab} />
      <div className="st-body">
        {tab === "metrics" && (
          <div className="it-list">
            {METRICS.map((m) => {
              const v = c.values[m];
              return (
                <div key={m} className="cr-metric">
                  <div className="cr-head">
                    <span><i style={{ color: metricTone(v) }}><Ic name={METRIC_ICON[m]} size={16} /></i>{METRIC_NAMES[m]}</span>
                    <span><Pm label={METRIC_NAMES[m]} onMinus={() => nudge(m, -5)} onPlus={() => nudge(m, 5)} /><b className="cr-val" style={{ color: metricTone(v) }}>{v}</b></span>
                  </div>
                  <div className="cr-bar"><div style={{ width: `${v}%`, background: metricTone(v) }} />{THRESHOLDS.map((t, i) => <u key={t} style={{ left: `${t}%`, opacity: 0.3 + i * 0.2 }} />)}</div>
                  {effectsFor(v, METRIC_NAMES[m]).map((e) => <div key={e} className="it-line"><Ic name="lucide:minus" size={12} /><span>{e}</span></div>)}
                </div>
              );
            })}
          </div>
        )}
        {tab === "npcs" && (
          <>
            {npcs.length > 0 && (
              <div className="it-list">
                {npcs.map((n) => (
                  <div key={n.id} className="cr-npc">
                    <div className="cr-npchead">
                      <span><Ic name="lucide:user" size={16} /><b>{n.npcName}</b></span>
                    </div>
                    <div className="it-line"><b>Cause:</b> {n.cause}</div>
                    {METRICS.map((m) => (
                      <div key={m} className="cr-metric small">
                        <div className="cr-head">
                          <span><i style={{ color: metricTone(n[m]) }}><Ic name={METRIC_ICON[m]} size={12} /></i><span>{METRIC_NAMES[m]}</span></span>
                          <span><Pm label={`${n.npcName} ${METRIC_NAMES[m]}`} onMinus={() => act({ kind: "npcChange", id: n.id, metric: m, delta: -5 })} onPlus={() => act({ kind: "npcChange", id: n.id, metric: m, delta: 5 })} /><b className="cr-val" style={{ color: metricTone(n[m]) }}>{n[m]}</b></span>
                        </div>
                        <div className="cr-bar thin"><div style={{ width: `${n[m]}%`, background: metricTone(n[m]) }} /></div>
                      </div>
                    ))}
                    <Chips items={n.effects ?? []} />
                    {n.description && <em className="it-note">{n.description}</em>}
                    <RefreshByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} noun="NPC" existing={n} preview={(x) => <Preview n={x} />} accept={(x) => act({ kind: "npcRefresh", id: n.id, npc: x })}
                      extra={<span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete" onClick={inner(() => act({ kind: "npcRemove", id: n.id, at: Date.now() }, `Deleted ${n.npcName}`))}>Delete</Button></span>} />
                  </div>
                ))}
              </div>
            )}
            <AddByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} label="Add NPC" noun="NPC" namePlaceholder="Enter NPC name" guidePlaceholder="Steers AI generation..." labels={{ name: "NPC Name", guide: "Guide (optional)" }}
              preview={(x) => <Preview n={x} />} accept={(x) => act({ kind: "npcAdd", npc: x, id: `npc-${crypto.randomUUID()}` })} />
            {npcs.length === 0 && <Empty icon="lucide:users" title="No NPC corruption tracked" hint="Add NPCs to track their corruption metrics" />}
          </>
        )}
        {tab === "effects" && (effects.length > 0
          ? <div className="it-list">{effects.map((e) => <div key={e} className="it-bonus"><span><Ic name="lucide:zap" size={16} /> {e}</span></div>)}</div>
          : <Empty icon="lucide:shield" title="No corruption effects" hint="You remain untainted... for now" />)}
        {tab === "history" && (c.log.length > 0
          ? (
            <div className="it-list">
              {c.log.slice(0, 20).map((l) => (
                <div key={l.id} className="cr-log">
                  <span className={l.delta > 0 ? "up" : "down"}><Ic name={l.delta > 0 ? "lucide:trending-up" : "lucide:trending-down"} size={12} /></span>
                  <div><div><b className="cap">{l.metric === "all" ? "Multiple" : l.metric}</b> <b className={l.delta > 0 ? "up" : "down"}>{l.delta > 0 ? "+" : ""}{l.delta}</b></div><small>{l.reason}</small><small>{new Date(l.at).toLocaleString()}</small></div>
                </div>
              ))}
            </div>
          )
          : <Empty icon="lucide:history" title="No history yet" hint="Your journey begins unsullied" />)}
      </div>
    </TrackerFrame>
  );
}

