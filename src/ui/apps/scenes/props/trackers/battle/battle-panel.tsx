/**
 * The Combat panel (RoleCall BattleWingPanel.tsx:226-760): Start or End Combat in the action strip, an IN COMBAT badge, the round and a compact turn bar
 * while a fight is on, then Enemies, Turn Order, Combat Log and Dice. The rules are core/trackers/battle.ts; this draws them and writes each change as one
 * whole state (ChatStore rule 43). Removing an enemy leaves an Undo. RoleCall's per-theme names for the panel (its "terminology") come from a world-theme
 * setting the stepper owned, which is not here, so the panel keeps RoleCall's default words.
 */
import { useState, type JSX } from "react";
import { applyBattle, battleLines, liveEnemies, readBattle, type BattleAction, type Enemy } from "../../../../../../core/trackers/battle";
import { Ic, type IconName } from "../../../../../_shared/ic";
import type { PopoutContext } from "../../../popout/popout-kind";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";
import { AddEnemy, CombatLog, Dice, EnemyCard, TurnList } from "./battle-parts";

type Tab = "enemies" | "turns" | "log" | "dice";
const TABS: readonly { id: Tab; icon: IconName; label: string }[] = [
  { id: "enemies", icon: "lucide:skull", label: "Enemies" }, { id: "turns", icon: "lucide:list-ordered", label: "Turn Order" }, { id: "log", icon: "lucide:scroll", label: "Combat Log" }, { id: "dice", icon: "lucide:dice-5", label: "Dice" },
];

export function CombatPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "battle", readBattle);
  const [tab, setTab] = useState<Tab>("enemies");
  const [adding, setAdding] = useState(false);
  const b = view.data;
  const enemies = liveEnemies(b);
  const act = (action: BattleAction, undoLabel?: string): void => view.apply((d) => applyBattle(d, action), undoLabel);
  const newEnemy = (e: Omit<Enemy, "id">): Enemy => ({ ...e, id: `enemy-${crypto.randomUUID()}` });
  return (
    <TrackerFrame label="Combat" title="Battle Tracker" icon="lucide:swords" tone="var(--stage-danger-text)" tokens={Math.ceil(battleLines(b).join("\n").length / 4)} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks combat encounters: enemies, HP, turn order, and dice rolls. The AI uses this to maintain combat consistency."
      onClear={() => view.apply(() => readBattle(undefined), "Cleared")}
      badge={b.inCombat ? <span className="bt-live">IN COMBAT</span> : null}
      actions={b.inCombat
        ? <button type="button" className="trk-btn" title="End Combat" aria-label="End Combat" onClick={() => act({ kind: "end" })}><Ic name="lucide:flag-off" size={14} /></button>
        : <button type="button" className="trk-btn" title="Start Combat" aria-label="Start Combat" onClick={() => act({ kind: "start", enemy: newEnemy({ name: "Unknown Enemy", hp: 50, maxHp: 50, isBoss: false, statusEffects: [], threat: "medium" }) })}><Ic name="lucide:flag" size={14} /></button>}>
      {b.inCombat && (
        <div className="bt-round">
          <span className="bt-roundtag">ROUND {b.round}</span>
          <span className="bt-pips">{b.turnOrder.map((id) => <i key={id} className={id === b.currentTurn ? "now" : ""} title={enemies.find((e) => e.id === id)?.name ?? "Unknown"} />)}</span>
          <button type="button" className="trk-btn" title="Next Turn" aria-label="Next Turn" onClick={() => act({ kind: "next" })}><Ic name="lucide:skip-forward" size={14} /></button>
        </div>
      )}
      <div className="st-tabs bt-tabs" role="tablist">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}><Ic name={t.icon} size={14} /> {t.label}</button>)}
      </div>
      <div className="st-body">
        {tab === "enemies" && (
          <>
            {adding ? <AddEnemy onCancel={() => setAdding(false)} onAdd={(e) => { act({ kind: "add", enemy: newEnemy(e) }); setAdding(false); }} />
              : <button type="button" className="bt-new" onClick={() => setAdding(true)}><Ic name="lucide:plus" size={14} /> Add New Enemy</button>}
            {enemies.map((e) => (
              <EnemyCard key={e.id} enemy={e} current={e.id === b.currentTurn} onDamage={(amount) => act({ kind: "damage", id: e.id, amount })} onHeal={(amount) => act({ kind: "heal", id: e.id, amount })}
                onRemove={() => act({ kind: "remove", id: e.id, at: Date.now() }, `Removed ${e.name}`)} />
            ))}
            {enemies.length === 0 && !adding && <div className="bt-empty"><Ic name="lucide:skull" size={48} /><p>No enemies in combat</p><small>Add enemies to begin tracking battle</small></div>}
          </>
        )}
        {tab === "turns" && <TurnList order={b.turnOrder} current={b.currentTurn} round={b.round} enemies={enemies} onNext={() => act({ kind: "next" })} />}
        {tab === "log" && <CombatLog log={b.log} onClear={() => act({ kind: "clearLog" })} />}
        {tab === "dice" && <Dice history={b.dice} onRoll={(expression) => act({ kind: "roll", expression, at: Date.now(), rand: Math.random })} onClear={() => act({ kind: "clearDice" })} />}
      </div>
    </TrackerFrame>
  );
}
