/**
 * The Combat panel's parts (RoleCall `components/immersion/battle/{EnemyCard,TurnOrderDisplay,CombatLog,DiceRoller}.tsx` and BattleWingPanel's AddEnemyModal):
 * an enemy card with its HP bar, threat, status and a damage or heal box ("Damage (+) or Heal (-)"), the turn list, the log and the dice. The add form is an
 * inline card here, where RoleCall opens a modal over the scene. RoleCall's Reorder drag of the turn list is not drawn: nothing in the panel wires it (the
 * prop is never passed), so it never worked.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { hpBand, hpPercent, THREATS, type DiceRoll, type Enemy, type Threat } from "../../../../../../core/trackers/battle";
import { Ic, type IconName } from "../../../../../_shared/ic";

const THREAT: Readonly<Record<Threat, { tone: string; icon: IconName; label: string }>> = {
  low: { tone: "var(--stage-ok)", icon: "lucide:check", label: "Low" }, medium: { tone: "var(--stage-warn)", icon: "lucide:info", label: "Medium" },
  high: { tone: "var(--stage-warn)", icon: "lucide:circle-alert", label: "High" }, critical: { tone: "var(--stage-danger-text)", icon: "lucide:skull", label: "Critical" },
};
const BAND = { good: "var(--stage-ok)", low: "var(--stage-warn)", critical: "var(--stage-danger-text)" } as const;

export function EnemyCard({ enemy, current, onDamage, onHeal, onRemove }: { enemy: Enemy; current: boolean; onDamage(n: number): void; onHeal(n: number): void; onRemove(): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const t = THREAT[enemy.threat];
  const percent = hpPercent(enemy);
  const tone = BAND[hpBand(percent)];
  const apply = (): void => {
    const n = Number.parseInt(value, 10);
    if (!Number.isNaN(n) && n !== 0) (n > 0 ? onDamage(n) : onHeal(Math.abs(n)));
    setValue("");
    setOpen(false);
  };
  return (
    <article className={`bt-enemy${current ? " now" : ""}${enemy.hp <= 0 ? " down" : ""}`} data-enemy={enemy.id}>
      <header>
        <span className="bt-threat" style={{ color: enemy.isBoss ? "var(--stage-warn)" : t.tone }} title={`${t.label} threat`}><Ic name={enemy.isBoss ? "lucide:crown" : t.icon} size={16} /></span>
        <div className="bt-name">
          <b>{enemy.name}</b>{enemy.level !== undefined && <span className="bt-tag">Lv.{enemy.level}</span>}{enemy.isBoss && <span className="bt-tag boss">BOSS</span>}
          <div className="bt-hp">HP: <span style={{ color: tone }}>{enemy.hp}/{enemy.maxHp}</span></div>
        </div>
        <button type="button" className="bt-icon" title="Damage" aria-label={`Damage ${enemy.name}`} onClick={() => setOpen(!open)}><Ic name="lucide:swords" size={16} /></button>
        <button type="button" className="bt-icon" title="Remove" aria-label={`Remove ${enemy.name}`} onClick={onRemove}><Ic name="lucide:x" size={16} /></button>
      </header>
      <div className="bt-bar"><div style={{ width: `${Math.min(100, percent)}%`, background: tone }} /></div>
      {enemy.statusEffects.length > 0 && <div className="bt-tags">{enemy.statusEffects.map((s) => <span className="bt-tag" key={s}>{s}</span>)}</div>}
      {open && (
        <div className="bt-dmg">
          <input type="number" value={value} placeholder="Damage (+) or Heal (-)" aria-label="Damage or heal" autoFocus onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} />
          <button type="button" className="bt-go" onClick={apply}>Apply</button>
          <button type="button" className="bt-cancel" onClick={() => { setValue(""); setOpen(false); }}>Cancel</button>
        </div>
      )}
    </article>
  );
}

export function AddEnemy({ onAdd, onCancel }: { onAdd(e: Omit<Enemy, "id">): void; onCancel(): void }): JSX.Element {
  const [name, setName] = useState("");
  const [hp, setHp] = useState("50");
  const [maxHp, setMaxHp] = useState("50");
  const [level, setLevel] = useState("");
  const [threat, setThreat] = useState<Threat>("medium");
  const [boss, setBoss] = useState(false);
  const submit = (): void => {
    const max = Math.max(1, Number.parseInt(maxHp, 10) || 50);
    const now = Math.min(max, Math.max(0, Number.parseInt(hp, 10) || 50));
    const lv = level ? Number.parseInt(level, 10) : undefined;
    onAdd({ name: (name.trim() || "Unknown Enemy").slice(0, 80), hp: now, maxHp: max, ...(lv !== undefined && Number.isFinite(lv) && lv >= 0 ? { level: lv } : {}), isBoss: boss, statusEffects: [], threat });
  };
  return (
    <div className="bt-add" role="group" aria-label="Add Enemy">
      <h3>Add Enemy</h3>
      <label>Name<input value={name} placeholder="Enemy name" onChange={(e) => setName(e.target.value)} /></label>
      <div className="bt-two"><label>HP<input type="number" value={hp} onChange={(e) => setHp(e.target.value)} /></label><label>Max HP<input type="number" value={maxHp} onChange={(e) => setMaxHp(e.target.value)} /></label></div>
      <div className="bt-two"><label>Level<input type="number" value={level} placeholder="Optional" onChange={(e) => setLevel(e.target.value)} /></label>
        <label>Threat<select value={threat} onChange={(e) => setThreat(e.target.value as Threat)}>{THREATS.map((x) => <option key={x} value={x}>{THREAT[x].label}</option>)}</select></label></div>
      <label className="bt-check"><input type="checkbox" checked={boss} onChange={(e) => setBoss(e.target.checked)} /> Boss enemy</label>
      <div className="bt-two"><button type="button" className="bt-cancel" onClick={onCancel}>Cancel</button><button type="button" className="bt-go" onClick={submit}>Add Enemy</button></div>
    </div>
  );
}

export function TurnList({ order, current, round, enemies, onNext }: { order: readonly string[]; current: string | null; round: number; enemies: readonly Enemy[]; onNext(): void }): JSX.Element {
  return (
    <div className="bt-turns">
      <div className="bt-turns-head"><span><Ic name="lucide:list-ordered" size={16} /> Turn Order</span><span>Round {round}<button type="button" className="bt-go" onClick={onNext}><Ic name="lucide:skip-forward" size={12} /> Next Turn</button></span></div>
      {order.length === 0 ? <p className="bt-empty">Nobody in the turn order.</p> : order.map((id) => {
        const e = enemies.find((x) => x.id === id);
        return <div key={id} className={`bt-turn${id === current ? " now" : ""}${e && e.hp <= 0 ? " down" : ""}`}><i /> <b>{e?.name ?? "Unknown"}</b>{e?.isBoss && <span className="bt-tag boss">BOSS</span>}</div>;
      })}
    </div>
  );
}

export function CombatLog({ log, onClear }: { log: readonly string[]; onClear(): void }): JSX.Element {
  return (
    <div className="bt-log">
      <div className="bt-log-head"><span>Combat Log</span>{log.length > 0 && <button type="button" onClick={onClear}>Clear</button>}</div>
      {log.length === 0 ? <p className="bt-empty">No combat activity yet...</p> : <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export function Dice({ history, onRoll, onClear }: { history: readonly DiceRoll[]; onRoll(expression: string): void; onClear(): void }): JSX.Element {
  const [custom, setCustom] = useState("");
  const last = history.at(-1);
  const roll = (expression: string): void => onRoll(expression);
  return (
    <div className="bt-dice">
      <div className="bt-dice-title"><Ic name="lucide:dice-5" size={16} /> Dice Roller</div>
      <button type="button" className="bt-d20" onClick={() => roll("d20")}>Roll d20</button>
      <div className="bt-dice-row">{DICE.map((s) => <button type="button" key={s} title={`Roll d${s}`} onClick={() => roll(`d${s}`)}>d{s}</button>)}</div>
      <div className="bt-dice-custom">
        <input value={custom} placeholder="2d6+3, 4d8-2..." aria-label="Dice expression" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { roll(custom.trim()); setCustom(""); } }} />
        <button type="button" disabled={!custom.trim()} onClick={() => { roll(custom.trim()); setCustom(""); }}>Roll</button>
      </div>
      {last && (
        <div className="bt-roll" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>
          <small>{last.expression}</small><b>{last.total}</b>
          {last.rolls.length > 1 && <span>{last.rolls.join(" + ")}{last.modifier !== 0 ? ` ${last.modifier > 0 ? "+" : "-"} ${Math.abs(last.modifier)}` : ""}</span>}
        </div>
      )}
      {history.length > 0 && (
        <div className="bt-hist"><div className="bt-log-head"><span>History</span><button type="button" onClick={onClear}>Clear</button></div>
          <ul>{[...history].reverse().map((h, i) => <li key={`${h.at}:${i}`}><span>{h.expression}</span><b>{h.total}</b></li>)}</ul></div>
      )}
    </div>
  );
}

