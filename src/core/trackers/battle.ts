/**
 * The Combat tracker, RoleCall's `battle` module (stores/immersion/battle-tracker.ts, components/immersion/battle/*, BattleWingPanel.tsx): the enemies with
 * their HP, threat and status, the turn order and round, a combat log and a dice roller. Pure: the panel computes the next state with `applyBattle` and the
 * scene keeps it (ChatStore rule 43). Dice take their randomness from the caller, so a roll is provable.
 *
 * Differences from RoleCall, each a repaired flaw: a removed enemy is kept with `removedAt` and can be brought back, where RoleCall's
 * remove deletes it; and the prompt names whose turn it is, where RoleCall's line prints the turn holder's internal id (`enemy_<name>_<time>`).
 */
import { isPlainObject } from "../guards";
import { bool, num as numShape, obj, oneOf, opt, refine, str } from "./shape";
import { byName, entry, listOf, single, sync, type RefreshSpec } from "./refresh";

export const THREATS = ["low", "medium", "high", "critical"] as const;
export type Threat = (typeof THREATS)[number];

export type Enemy = { id: string; name: string; hp: number; maxHp: number; level?: number; isBoss: boolean; statusEffects: string[]; threat: Threat; removedAt?: number };
export type DiceRoll = { expression: string; rolls: number[]; modifier: number; total: number; at: number };
export type Battle = { inCombat: boolean; enemies: Enemy[]; turnOrder: string[]; currentTurn: string | null; log: string[]; round: number; dice: DiceRoll[] };

export const DEFAULT_BATTLE: Battle = { inCombat: false, enemies: [], turnOrder: [], currentTurn: null, log: [], round: 0, dice: [] };

const ENEMIES_MAX = 100, LOG_MAX = 100, DICE_MAX = 20, STATUS_MAX = 12;
const NUM_MAX = 1_000_000;

function num(v: unknown, lo: number, hi = NUM_MAX): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
}
const text = (v: unknown, max: number, min = 0): string | null => (typeof v === "string" && v.length >= min && v.length <= max && !v.includes("\u0000") ? v : null);

function parseEnemy(raw: unknown): Enemy | null {
  if (!isPlainObject(raw) || Object.keys(raw).some((k) => !["id", "name", "hp", "maxHp", "level", "isBoss", "statusEffects", "threat", "removedAt"].includes(k))) return null;
  const id = text(raw["id"], 80, 1), name = text(raw["name"], 80, 1), hp = num(raw["hp"], 0), maxHp = num(raw["maxHp"], 1);
  const level = raw["level"] === undefined ? undefined : num(raw["level"], 0, 9999), removedAt = raw["removedAt"] === undefined ? undefined : num(raw["removedAt"], 0, 1e15);
  const effects = raw["statusEffects"];
  if (id === null || name === null || hp === null || maxHp === null || hp > maxHp || level === null || removedAt === null || typeof raw["isBoss"] !== "boolean") return null;
  if (!THREATS.includes(raw["threat"] as Threat) || !Array.isArray(effects) || effects.length > STATUS_MAX || !effects.every((e) => text(e, 40, 1) !== null)) return null;
  return { id, name, hp, maxHp, ...(level === undefined ? {} : { level }), isBoss: raw["isBoss"], statusEffects: [...(effects as string[])], threat: raw["threat"] as Threat, ...(removedAt === undefined ? {} : { removedAt }) };
}

function parseDice(raw: unknown): DiceRoll | null {
  if (!isPlainObject(raw) || Object.keys(raw).some((k) => !["expression", "rolls", "modifier", "total", "at"].includes(k))) return null;
  const expression = text(raw["expression"], 20, 1), modifier = num(raw["modifier"], -NUM_MAX), total = num(raw["total"], -NUM_MAX), at = num(raw["at"], 0, 1e15);
  const rolls = raw["rolls"];
  if (expression === null || modifier === null || total === null || at === null || !Array.isArray(rolls) || rolls.length > 100 || !rolls.every((r) => num(r, 1) !== null)) return null;
  return { expression, rolls: [...(rolls as number[])], modifier, total, at };
}

/** The state the store keeps, checked once. Null: refused. */
export function parseBattle(data: unknown): Battle | null {
  if (!isPlainObject(data) || Object.keys(data).some((k) => !["inCombat", "enemies", "turnOrder", "currentTurn", "log", "round", "dice"].includes(k))) return null;
  const rawEnemies = data["enemies"] ?? [], rawLog = data["log"] ?? [], rawDice = data["dice"] ?? [], rawTurns = data["turnOrder"] ?? [];
  if (!Array.isArray(rawEnemies) || rawEnemies.length > ENEMIES_MAX || !Array.isArray(rawLog) || rawLog.length > LOG_MAX || !Array.isArray(rawDice) || rawDice.length > DICE_MAX || !Array.isArray(rawTurns) || rawTurns.length > ENEMIES_MAX) return null;
  const enemies = rawEnemies.map(parseEnemy), dice = rawDice.map(parseDice);
  const round = num(data["round"] ?? 0, 0, 100_000), current = data["currentTurn"] ?? null;
  if (enemies.some((e) => e === null) || dice.some((d) => d === null) || round === null || typeof (data["inCombat"] ?? false) !== "boolean") return null;
  if (!rawLog.every((l) => text(l, 300) !== null) || !rawTurns.every((t) => text(t, 80, 1) !== null) || (current !== null && text(current, 80, 1) === null)) return null;
  return { inCombat: (data["inCombat"] ?? false) as boolean, enemies: enemies as Enemy[], turnOrder: [...(rawTurns as string[])], currentTurn: current as string | null, log: [...(rawLog as string[])], round, dice: dice as DiceRoll[] };
}

export const readBattle = (data: unknown): Battle => (data === undefined ? DEFAULT_BATTLE : parseBattle(data) ?? DEFAULT_BATTLE);

/** The enemies in the fight: a removed one is kept for Undo and never listed or sent. */
export const liveEnemies = (b: Battle): Enemy[] => b.enemies.filter((e) => e.removedAt === undefined);

export const hpPercent = (e: Pick<Enemy, "hp" | "maxHp">): number => Math.round((e.hp / e.maxHp) * 100);
/** The HP bar's colour band (EnemyCard.tsx:hpColor): over 66% good, over 33% low, else critical. */
export const hpBand = (percent: number): "good" | "low" | "critical" => (percent > 66 ? "good" : percent > 33 ? "low" : "critical");

/** "2d6+3", "d20", "3d8-2" (battle-tracker.ts:parseDiceExpression); anything else is one d20, as RoleCall reads it. */
export function parseDice20(expression: string): { count: number; sides: number; modifier: number } {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(expression.trim());
  if (!m) return { count: 1, sides: 20, modifier: 0 };
  return { count: Math.min(m[1] ? Number.parseInt(m[1], 10) : 1, 100), sides: Math.max(1, Number.parseInt(m[2]!, 10)), modifier: m[3] ? Number.parseInt(m[3], 10) : 0 };
}

export type BattleAction =
  | { kind: "start"; enemy: Enemy }
  | { kind: "end" }
  | { kind: "add"; enemy: Enemy }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string }
  | { kind: "damage"; id: string; amount: number }
  | { kind: "heal"; id: string; amount: number }
  | { kind: "next" }
  | { kind: "clearLog" }
  | { kind: "roll"; expression: string; at: number; rand: () => number }
  | { kind: "clearDice" };

const log = (b: Battle, ...entries: string[]): string[] => [...b.log, ...entries].slice(-LOG_MAX);

/** One panel action, as RoleCall's store does it (battle-tracker.ts:98-240), returning the next state. */
export function applyBattle(b: Battle, a: BattleAction): Battle {
  const live = (id: string): Enemy | undefined => b.enemies.find((e) => e.id === id && e.removedAt === undefined);
  switch (a.kind) {
    case "start": return { ...b, inCombat: true, enemies: [a.enemy], turnOrder: [a.enemy.id], currentTurn: a.enemy.id, log: ["Combat started!"], round: 1 };
    case "end": return { ...b, inCombat: false, currentTurn: null, log: log(b, "Combat ended.") };
    case "add": return b.enemies.length >= ENEMIES_MAX ? b : { ...b, enemies: [...b.enemies, a.enemy], turnOrder: [...b.turnOrder, a.enemy.id], log: log(b, `${a.enemy.name} joined the battle!`) };
    case "remove": {
      const e = live(a.id);
      return e ? { ...b, enemies: b.enemies.map((x) => (x === e ? { ...x, removedAt: a.at } : x)), turnOrder: b.turnOrder.filter((t) => t !== a.id), log: log(b, `${e.name} was defeated!`) } : b;
    }
    case "restore": {
      const e = b.enemies.find((x) => x.id === a.id && x.removedAt !== undefined);
      if (!e) return b;
      const { removedAt: _gone, ...back } = e;
      return { ...b, enemies: b.enemies.map((x) => (x === e ? back : x)), turnOrder: [...b.turnOrder, a.id], log: log(b, `${e.name} rejoined the battle!`) };
    }
    case "damage": {
      const e = live(a.id);
      if (!e) return b;
      const hp = Math.max(0, e.hp - Math.abs(a.amount));
      return { ...b, enemies: b.enemies.map((x) => (x === e ? { ...x, hp } : x)), log: log(b, `${e.name} took ${Math.abs(a.amount)} damage! (${hp}/${e.maxHp} HP)`, ...(hp === 0 ? [`${e.name} was defeated!`] : [])) };
    }
    case "heal": {
      const e = live(a.id);
      return e ? { ...b, enemies: b.enemies.map((x) => (x === e ? { ...x, hp: Math.min(e.maxHp, e.hp + Math.abs(a.amount)) } : x)) } : b;
    }
    case "next": {
      if (b.turnOrder.length === 0) return b;
      const next = (b.turnOrder.indexOf(b.currentTurn ?? "") + 1) % b.turnOrder.length;
      const round = next === 0 ? b.round + 1 : b.round;
      return { ...b, currentTurn: b.turnOrder[next] ?? null, round, log: next === 0 ? log(b, `--- Round ${round} ---`) : b.log };
    }
    case "clearLog": return { ...b, log: [] };
    case "roll": {
      const { count, sides, modifier } = parseDice20(a.expression);
      const rolls = Array.from({ length: count }, () => Math.floor(a.rand() * sides) + 1);
      const roll: DiceRoll = { expression: a.expression.trim().slice(0, 20), rolls, modifier, total: rolls.reduce((n, r) => n + r, 0) + modifier, at: a.at };
      return { ...b, dice: [...b.dice, roll].slice(-DICE_MAX), log: log(b, `Roll ${roll.expression}: [${rolls.join(", ")}]${modifier !== 0 ? ` ${modifier > 0 ? "+" : ""}${modifier}` : ""} = ${roll.total}`) };
    }
    case "clearDice": return { ...b, dice: [] };
  }
}

/** The narrator's Combat line (immersion-context.ts:99-105), with the turn named, not its id. Nothing when no combat is on. */
export function battleLines(b: Battle): string[] {
  if (!b.inCombat) return [];
  const enemies = liveEnemies(b);
  const turn = enemies.find((e) => e.id === b.currentTurn)?.name ?? "Unknown";
  return [`**Combat**: In combat! Round ${b.round} | Turn: ${turn} | Enemies: ${enemies.map((e) => `${e.name} (HP ${e.hp}/${e.maxHp}, ${e.threat} threat)`).join(", ")}`];
}

const ENEMY_MADE = refine(obj({ name: str({ max: 80, min: 1 }), hp: numShape({ lo: 0, hi: NUM_MAX }), maxHp: numShape({ lo: 1, hi: NUM_MAX }), level: opt(numShape({ lo: 0, hi: 9999 })), isBoss: bool({ def: false }), threat: oneOf(THREATS, "low") }),
  { fix: (e) => ({ ...e, hp: Math.min(e.hp, e.maxHp) }), valid: (e) => e.hp <= e.maxHp });

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.battle). The turn order, the log and the dice are the fight's own and only change as the actions change them. */
export const BATTLE_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: () => `If currently in combat, describe the battle state.
Format: { "inCombat": boolean, "enemies": [{ "name": string, "hp": number, "maxHp": number, "level": number, "isBoss": boolean, "threat": "low"|"medium"|"high"|"critical" }] }`,
  rows: (d) => {
    const b = readBattle(d);
    return [single("inCombat", "In combat", b.inCombat), ...liveEnemies(b).map((e) => entry("enemies", e.name, ENEMY_MADE.coerce(e) ?? e))];
  },
  next(d, a, env) {
    if (typeof a["inCombat"] !== "boolean") return null;
    const made = a["enemies"] === undefined && !a["inCombat"] ? [] : listOf(a, "enemies", ENEMY_MADE, env);
    if (!made) return null;
    const b = readBattle(d);
    const next = sync(b, liveEnemies(b), made, byName, {
      refresh: (s, old, m) => ({ ...s, enemies: s.enemies.map((e) => (e.id === old.id ? { ...e, ...m } : e)) }),
      add: (s, m) => applyBattle(s, { kind: "add", enemy: { ...m, id: env.id(), statusEffects: [] } }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyBattle(s, { kind: "remove", id: old.id, at: env.now }),
    });
    if (a["inCombat"] === next.inCombat) return next;
    return a["inCombat"] ? { ...next, inCombat: true, round: next.round || 1, currentTurn: next.currentTurn ?? next.turnOrder[0] ?? null } : applyBattle(next, { kind: "end" });
  },
};
