/**
 * The Stats panel (RoleCall ResourcesWingPanel.tsx:607-925): Level and XP, the HP, MP and AP bars with their minus and plus buttons, the shield
 * and currency cards, the survival needs, and a History tab of recent changes. The hero action is Full Restore. The rules are core/trackers/
 * resources.ts; this draws them and writes each change as one whole state (ChatStore rule 43). Until the Story Director exists the buttons are
 * how the numbers move, as they are for RoleCall's person at the table.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { applyResources, hpBand, needBand, percentOf, readResources, resourcesLines, type Need, type ResourceAction, type ResourceKind, type Resources } from "../../../../../../core/trackers/resources";
import { Button, IconButton, Tabs } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";
import type { PopoutContext } from "../../../popout/popout-kind";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const TONE = { critical: "var(--stage-danger-text)", low: "var(--stage-warn)", moderate: "var(--stage-warn)", good: "var(--stage-ok)" } as const;
const LOG_ICON: Readonly<Record<ResourceKind, { icon: IconName; tone: string }>> = {
  hp: { icon: "lucide:heart", tone: "var(--stage-danger-text)" }, mp: { icon: "lucide:droplet", tone: "var(--stage-var)" }, ap: { icon: "lucide:zap", tone: "var(--stage-warn)" },
  shield: { icon: "lucide:shield", tone: "var(--stage-link)" }, xp: { icon: "lucide:star", tone: "var(--stage-macro)" }, level: { icon: "lucide:circle-arrow-up", tone: "var(--stage-ok)" }, currency: { icon: "lucide:coins", tone: "var(--stage-warn)" },
};
const NEED_ICON: Readonly<Record<string, IconName>> = { thirst: "lucide:droplets", hygiene: "lucide:droplet", energy: "lucide:zap", stamina: "lucide:flame", comfort: "lucide:armchair", morale: "lucide:smile", warmth: "lucide:thermometer-sun", cold: "lucide:thermometer-snowflake" };

function Bar({ label, icon, current, max, tone, onMinus, onPlus }: { label: string; icon: IconName; current: number; max: number; tone: string; onMinus(): void; onPlus(): void }): JSX.Element {
  return (
    <div className="st-bar" style={{ "--c": tone } as CSSProperties}>
      <div className="st-bar-head"><span className="st-ic"><Ic name={icon} size={16} /></span><b>{label}</b><span className="st-val">{current}/{max}</span></div>
      <div className="st-bar-row">
        <IconButton size="sm" label={`Decrease ${label}`} icon="lucide:minus" onClick={onMinus} />
        <div className="st-track"><div style={{ width: `${percentOf(current, max)}%` }} /></div>
        <IconButton size="sm" label={`Increase ${label}`} icon="lucide:plus" onClick={onPlus} />
      </div>
    </div>
  );
}

function NeedBar({ id, need, onChange }: { id: string; need: Need; onChange(delta: number): void }): JSX.Element {
  const label = need.label || id.charAt(0).toUpperCase() + id.slice(1);
  const percent = percentOf(need.value, need.maxValue);
  return (
    <div className="st-need" style={{ "--c": TONE[needBand(percent)] } as CSSProperties}>
      <span className="st-ic"><Ic name={NEED_ICON[id.toLowerCase()] ?? "lucide:gauge"} size={14} /></span>
      <span className="st-need-label">{label}</span>
      <IconButton size="sm" label={`Decrease ${label}`} icon="lucide:minus" onClick={() => onChange(-5)} />
      <div className="st-track thin"><div style={{ width: `${percent}%` }} /></div>
      <IconButton size="sm" label={`Increase ${label}`} icon="lucide:plus" onClick={() => onChange(5)} />
      <span className="st-need-val">{need.value}/{need.maxValue}</span>
    </div>
  );
}

export function StatsPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "resources", readResources);
  const [tab, setTab] = useState<"bars" | "log">("bars");
  const r: Resources = view.data;
  const act = (action: ResourceAction, undoLabel?: string): void => view.apply((d) => applyResources(d, action, { now: Date.now(), id: () => crypto.randomUUID() }), undoLabel);
  const needs = Object.entries(r.needs);
  return (
    <TrackerFrame label="Stats" title="Player Stats" icon="lucide:heart" tone="var(--stage-ok)" tokens={Math.ceil(resourcesLines(r).join("\n").length / 4)} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks player stats: HP, MP, AP, XP, gold, and custom needs. The AI adjusts encounters based on your current state."
      onClear={() => act({ kind: "reset" }, "Cleared")}
      actions={<IconButton size="sm" label="Full Restore" icon="lucide:sparkles" onClick={() => act({ kind: "restore", reason: "Manual restore" })} />}>
      <div className="st-tabs">
        <Tabs label="Stats sections" value={tab} onChange={setTab} items={[
          { value: "bars", label: <><Ic name="lucide:chart-no-axes-column" size={14} /> Stats</> },
          { value: "log", label: <><Ic name="lucide:scroll" size={14} /> History</> },
        ]} />
      </div>
      <div className="st-body">
        {tab === "bars" ? (
          <>
            <div className="st-card" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>
              <span className="st-ic"><Ic name="lucide:star" size={20} /></span>
              <div><b>Level {r.level}</b><small>{r.xp} XP</small></div>
            </div>
            <Bar label="HP" icon="lucide:heart" current={r.hp} max={r.maxHp} tone={TONE[hpBand(percentOf(r.hp, r.maxHp))]}
              onMinus={() => act({ kind: "damage", amount: 10, reason: "Manual damage" })} onPlus={() => act({ kind: "heal", amount: 10, reason: "Manual heal" })} />
            <Bar label="MP" icon="lucide:droplet" current={r.mp} max={r.maxMp} tone="var(--stage-var)"
              onMinus={() => act({ kind: "mp", delta: -10, reason: "Manual spend" })} onPlus={() => act({ kind: "mp", delta: 10, reason: "Manual restore" })} />
            <Bar label="AP" icon="lucide:zap" current={r.ap} max={r.maxAp} tone="var(--stage-warn)"
              onMinus={() => act({ kind: "ap", delta: -1, reason: "Action spent" })} onPlus={() => act({ kind: "ap", delta: 1, reason: "Action restored" })} />
            {r.shield > 0 && (
              <div className="st-card st-shield" style={{ "--c": "var(--stage-link)" } as CSSProperties}>
                <span className="st-ic"><Ic name="lucide:shield" size={20} /></span><b>Shield</b><strong>{r.shield}</strong>
              </div>
            )}
            <div className="st-card" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>
              <span className="st-ic"><Ic name="lucide:coins" size={20} /></span><b>Currency</b><strong>{r.currency}</strong>
            </div>
            {needs.length > 0 && (
              <div className="st-needs">
                <div className="st-needs-head"><Ic name="lucide:thermometer" size={16} /> Survival Needs</div>
                {needs.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ ([key, need]) => <NeedBar key={key} id={key} need={need} onChange={(delta) => act({ kind: "need", key, delta })} />)}
              </div>
            )}
          </>
        ) : (
          <div className="st-logwrap">
            <div className="st-loghead"><span>Recent Changes</span><Button variant="quiet" size="sm" onClick={() => act({ kind: "clearLog" })}>Clear</Button></div>
            {r.log.length === 0 ? (
              <div className="st-empty"><Ic name="lucide:scroll" size={40} /><p>No changes recorded</p></div>
            ) : (
              <ul className="st-log">
                {r.log.slice(0, 20).map((entry) => {
                  const delta = entry.value - entry.previous;
                  const g = LOG_ICON[entry.type];
                  return (
                    <li key={entry.id}>
                      <span style={{ color: g.tone }}><Ic name={g.icon} size={16} /></span>
                      <span className="st-log-text">{entry.type.toUpperCase()}{entry.reason && <i> - {entry.reason}</i>}</span>
                      <span className="st-delta" style={{ color: delta > 0 ? "var(--stage-ok)" : "var(--stage-danger-text)" }}>{delta > 0 ? "+" : ""}{delta}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </TrackerFrame>
  );
}
