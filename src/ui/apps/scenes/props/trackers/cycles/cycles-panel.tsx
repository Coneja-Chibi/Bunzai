/**
 * The Cycles panel (RoleCall BiologicalCyclesWingPanel.tsx:392-862): an All tab and one for each kind of cycle that exists, cards with the character, the kind, the phase
 * and two bars (progress, intensity), and under each: Refresh by the model, Delete, the lunar link, the fertility window, the pregnancy or menstrual card, mood and stat
 * effects, effects, symptoms, the description and when it started; and "Add Biological Cycle" (character, guide, Generate). The rules are core/trackers/cycles.ts. Generate and
 * Refresh propose a cycle kept only on Accept; Delete leaves an Undo. The lunar block cannot read a moon: RoleCall reads it from its Calendar, which waits on the
 * Story Director, so a lunar cycle shows RoleCall's own words for a moon it cannot find.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { CYCLE_TYPES, applyCycles, cyclesLines, daysRemaining, liveCycles, pregnancyProgress, readCycles, trimesterOf, trimesterProgress, typeCounts, type CycleType, type Cyc } from "../../../../../../core/trackers/cycles";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Button } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Chips, Empty, ItemCard, ItemList, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const TONE: Readonly<Record<CycleType, string>> = {
  heat: "var(--stage-danger-text)", rut: "color-mix(in srgb,var(--stage-warn) 60%,var(--stage-danger-text))", pregnancy: "color-mix(in srgb,var(--stage-danger-text) 40%,var(--stage-macro))",
  ovulation: "var(--stage-macro)", period: "color-mix(in srgb,var(--stage-danger-text) 70%,var(--stage-macro))", lunar: "var(--stage-link)", custom: "var(--stage-var)",
};
const ICON: Readonly<Record<CycleType, IconName>> = { heat: "lucide:flame", rut: "lucide:sparkles", pregnancy: "lucide:heart", ovulation: "lucide:sparkles", period: "lucide:droplet", lunar: "lucide:moon", custom: "lucide:circle-dot" };
const NAME: Readonly<Record<CycleType, string>> = { heat: "Heat", rut: "Rut", pregnancy: "Pregnancy", ovulation: "Ovulation", period: "Period", lunar: "Lunar", custom: "Custom" };
const PHASE = {
  menstruation: { label: "Menstruation", tone: "var(--stage-danger-text)", fertility: "low", text: "Period \u2014 uterine lining shedding" },
  follicular: { label: "Follicular", tone: "var(--stage-link)", fertility: "moderate", text: "Follicles developing \u2014 estrogen rising" },
  ovulation: { label: "Ovulation", tone: "var(--stage-ok)", fertility: "peak", text: "Egg released \u2014 highest fertility window" },
  luteal: { label: "Luteal", tone: "var(--stage-warn)", fertility: "low", text: "Post-ovulation \u2014 progesterone dominant" },
} as const;
const TRIMESTER = { 1: { label: "First Trimester", range: "Weeks 1-12", tone: "color-mix(in srgb,var(--stage-danger-text) 40%,var(--stage-macro))" }, 2: { label: "Second Trimester", range: "Weeks 13-26", tone: "var(--stage-macro)" }, 3: { label: "Third Trimester", range: "Weeks 27-40", tone: "var(--stage-warn)" } } as const;
const intensityTone = (n: number): string => (n >= 80 ? "var(--stage-danger-text)" : n >= 60 ? "color-mix(in srgb,var(--stage-warn) 60%,var(--stage-danger-text))" : n >= 40 ? "var(--stage-warn)" : n >= 20 ? "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-warn))" : "var(--stage-ok)");
const progressTone = (n: number): string => (n >= 90 ? "var(--stage-danger-text)" : n >= 70 ? "var(--stage-warn)" : n >= 50 ? "color-mix(in srgb,var(--stage-warn) 60%,var(--stage-ok))" : n >= 25 ? "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-warn))" : "var(--stage-link)");
const energyTone = (n: number): string => (n > 60 ? "var(--stage-ok)" : n > 30 ? "var(--stage-warn)" : "var(--stage-danger-text)");
const ASK = { module: "cycles" } as const;
type Tab = "all" | CycleType;
const typeName = (c: Cyc): string => (c.cycleType === "custom" && c.customTypeName ? c.customTypeName : NAME[c.cycleType]);

function Bar({ label, value, tone, thin }: { label: string; value: number; tone: string; thin?: boolean }): JSX.Element {
  return <div className="cy-bar"><div><span>{label}</span><span>{value}%</span></div><div className={`bd-bar${thin ? " thin" : ""}`}><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} /></div></div>;
}
function Preview({ c }: { c: Cyc }): JSX.Element {
  return <><p><b>{c.characterName}</b> ({typeName(c)}): {c.currentPhase}, progress {c.phaseProgress ?? 0}%, intensity {c.intensity ?? 50}%</p>{c.description && <p>{c.description}</p>}</>;
}

export function CyclesPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "cycles", readCycles);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);
  const book = view.data;
  const live = liveCycles(book);
  const counts = typeCounts(book);
  const shown = (tab === "all" ? live : live.filter((c) => c.cycleType === tab)).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  const act = (action: Parameters<typeof applyCycles>[1], undoLabel?: string): void => view.apply((d) => applyCycles(d, action), undoLabel);
  const tabs = [{ id: "all", icon: "lucide:moon", label: "All", count: live.length }, ...CYCLE_TYPES.filter((t) => counts[t] > 0).map((t) => ({ id: t, icon: ICON[t], label: NAME[t], count: counts[t] }))] as const;
  return (
    <TrackerFrame label="Cycles" title="Biological Cycles" icon="lucide:moon" tone="color-mix(in srgb,var(--stage-macro) 60%,var(--stage-danger-text))" tokens={tokensOf(cyclesLines(book))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks biological rhythms and cycles. The AI adjusts character behavior based on current phases."
      onClear={() => view.apply((d) => ({ ...readCycles(undefined), subs: d.subs }), "Cleared")}>
      <Tabs<Tab> tabs={tabs as never} value={tab} onChange={setTab} />
      <div className="st-body">
        {shown.length > 0 ? (
          <ItemList items={shown} render={(c) => {
              const tone = TONE[c.cycleType];
              const p = c.pregnancyData;
              return (
                <ItemCard color={tone} icon={null} title={c.characterName}
                  meta={<span className="it-line"><span style={{ color: tone }}><Ic name={ICON[c.cycleType]} size={14} /></span><span className="it-tag" style={{ "--c": tone } as CSSProperties}>{typeName(c)}</span></span>}
                  under={(
                    <div className="cy-under">
                      <div className="cy-phase"><span>Phase:</span><b>{c.currentPhase}</b></div>
                      <Bar label="Progress" value={c.phaseProgress ?? 0} tone={progressTone(c.phaseProgress ?? 0)} />
                      <Bar label="Intensity" value={c.intensity ?? 50} tone={intensityTone(c.intensity ?? 50)} />
                      {c.totalDuration && open !== c.id && <div className="it-note">Duration: {c.totalDuration}</div>}
                    </div>
                  )}
                  open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)}>
                  <RefreshByModel<Cyc> ctx={ctx} chatId={chat.id} ask={ASK} noun="cycle" existing={c} preview={(x) => <Preview c={x} />} accept={(x) => act({ kind: "refresh", id: c.id, cycle: x })}
                    extra={<span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete cycle" onClick={inner(() => { act({ kind: "remove", id: c.id, at: Date.now() }, `Deleted the cycle of ${c.characterName}`); setOpen(null); })}>Delete</Button></span>} />
                  {c.cycleType === "lunar" && c.linkedMoonName && (
                    <div className="it-box" style={{ "--c": "var(--stage-macro)" } as CSSProperties}>
                      <em>Link to calendar moon phases to track transformations</em>
                      {c.transformationType && <small><b>Transformation:</b> {c.transformationType}</small>}
                      {c.transformationTrigger && <small><b>Trigger:</b> {c.transformationTrigger.replace(/_/g, " ")}</small>}
                    </div>
                  )}
                  {c.fertilityWindow && (
                    <Block title="Fertility Window">
                      <div className="cy-bar"><div><span>Start → Peak → End</span>{c.conceptionChance !== undefined && <span className="it-tag" style={{ "--c": "var(--stage-danger-text)" } as CSSProperties}>{c.conceptionChance}% chance</span>}</div>
                        <div className="cy-window"><i style={{ flex: Math.max(1, c.fertilityWindow.peak - c.fertilityWindow.start) }} /><b /><i style={{ flex: Math.max(1, c.fertilityWindow.end - c.fertilityWindow.peak) }} /></div></div>
                    </Block>
                  )}
                  {p && (p.isPregnant ? (
                    <div className="it-box" style={{ "--c": "var(--stage-danger-text)" } as CSSProperties}>
                      <div className="cy-row"><span>{p.babySizeEmoji && <span aria-hidden="true">{p.babySizeEmoji} </span>}<b>Week {p.weekNumber}</b><small>Baby is the size of {p.babySizeComparison}</small></span><small>{daysRemaining(p.daysPregnant ?? 0)} days remaining</small></div>
                      <Bar label="Pregnancy Progress" value={pregnancyProgress(p.weekNumber ?? 0)} tone="var(--stage-macro)" />
                      <div className="cy-row"><span className="it-tag" style={{ "--c": TRIMESTER[(p.trimester ?? trimesterOf(p.weekNumber ?? 0)) as 1 | 2 | 3].tone } as CSSProperties}>{TRIMESTER[(p.trimester ?? trimesterOf(p.weekNumber ?? 0)) as 1 | 2 | 3].label}</span><small>{TRIMESTER[(p.trimester ?? trimesterOf(p.weekNumber ?? 0)) as 1 | 2 | 3].range}</small><div className="bd-bar thin" style={{ flex: 1 }}><div style={{ width: `${trimesterProgress(p.weekNumber ?? 0)}%`, background: TRIMESTER[(p.trimester ?? 1) as 1 | 2 | 3].tone }} /></div></div>
                      {p.babyDevelopment && <small><b>Development:</b> {p.babyDevelopment}</small>}
                      <div className="cy-row">{p.conceptionDate && <small><Ic name="lucide:heart" size={12} /> Conceived: {p.conceptionDate}</small>}{p.dueDate && <small><Ic name="lucide:calendar" size={12} /> Due: {p.dueDate}</small>}</div>
                      {p.energyLevel !== undefined && <Bar label="Energy" value={p.energyLevel} tone={energyTone(p.energyLevel)} thin />}
                      {p.moodSummary && <small><b>Mood:</b> {p.moodSummary}</small>}
                      {p.symptoms && p.symptoms.length > 0 && <Block title="Symptoms"><Chips items={p.symptoms} /></Block>}
                      {p.cravings && p.cravings.length > 0 && <Block title="Cravings"><Chips items={p.cravings} /></Block>}
                    </div>
                  ) : (
                    <div className="it-box" style={{ "--c": "var(--stage-link)" } as CSSProperties}>
                      {p.cyclePhase && <><div className="cy-row"><span><b>{PHASE[p.cyclePhase].label}</b></span><span className="it-tag" style={{ "--c": PHASE[p.cyclePhase].tone } as CSSProperties}>{PHASE[p.cyclePhase].fertility} fertility</span></div><small>{PHASE[p.cyclePhase].text}</small></>}
                      {p.cycleDay !== undefined && p.cycleLength && <><div className="cy-row"><small>Cycle Day {p.cycleDay} of {p.cycleLength}</small>{p.daysUntilPeriod !== undefined && <small>{p.daysUntilPeriod} days until period</small>}</div><div className="bd-bar thin"><div style={{ width: `${(p.cycleDay / p.cycleLength) * 100}%`, background: p.cyclePhase ? PHASE[p.cyclePhase].tone : "var(--stage-link)" }} /></div></>}
                      {p.energyLevel !== undefined && <Bar label="Energy" value={p.energyLevel} tone={energyTone(p.energyLevel)} thin />}
                      {p.moodSummary && <small><b>Mood:</b> {p.moodSummary}</small>}
                      {p.symptoms && p.symptoms.length > 0 && <Block title="Symptoms"><Chips items={p.symptoms} /></Block>}
                    </div>
                  ))}
                  {c.moodModifiers && c.moodModifiers.length > 0 && <Block title="Mood Effects"><Chips items={c.moodModifiers} /></Block>}
                  {c.statEffects && Object.keys(c.statEffects).length > 0 && (
                    <Block title="Stat Effects"><div className="it-chips">{Object.entries(c.statEffects).map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ ([k, v]) => <span key={k} className={`it-chip${v > 0 ? "" : " bad"}`}>{v > 0 ? "+" : ""}{v} {k}</span>)}</div></Block>
                  )}
                  {c.totalDuration && <div className="it-line"><Ic name="lucide:clock" size={14} /><span>Total duration: {c.totalDuration}</span></div>}
                  {c.effects && c.effects.length > 0 && <Block title="Active Effects"><Chips items={c.effects} /></Block>}
                  {c.symptoms && c.symptoms.length > 0 && <Block title="Symptoms"><ul className="cy-list">{c.symptoms.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (s, i) => <li key={`${s}${i}`}>{s}</li>)}</ul></Block>}
                  {c.description && <Block title="Description"><p><em>{c.description}</em></p></Block>}
                  {c.nextPhaseAt && <div className="it-line"><Ic name="lucide:calendar" size={14} /><span>Next phase: {new Date(c.nextPhaseAt).toLocaleString()}</span></div>}
                  <div className="it-fine"><div>Started: {new Date(c.startedAt ?? 0).toLocaleString()}</div></div>
                </ItemCard>
              );
            }} />
        ) : <Empty icon="lucide:moon" title={tab === "lunar" ? "No lunar cycles tracked" : "No cycles tracked"} hint={tab === "lunar" ? "Add werewolf or lycanthropic characters to track their moon-linked transformations" : "Cycles will be added as the story progresses"} />}
        <AddByModel<Cyc> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Biological Cycle" noun="cycle" namePlaceholder="Character name" guidePlaceholder="Guide the AI... (e.g., 'entering heat cycle')"
          preview={(x) => <Preview c={x} />} accept={(x) => act({ kind: "add", cycle: x, id: `cycle-${crypto.randomUUID()}`, at: Date.now() })} />
      </div>
    </TrackerFrame>
  );
}
