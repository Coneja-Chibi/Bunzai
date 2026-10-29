/**
 * The closed macro registry (ADR-012 decision 5), holding RoleCall's handler families.
 *
 * There is no runtime registration API: the table is built once from `CATALOG` and never changes,
 * so the evaluator can only run handlers Bunzai ships, chosen by name. An unlisted name is an
 * unknown macro. RoleCall builds the same table by calling register functions at startup; the
 * lookup rules below are its rules exactly, because they decide which handler owns a name that
 * two families both claim:
 *
 * - Names are stored as written. A mixed-case name ({{They}}) stays distinct from its lowercase
 *   form; a second family registering an existing name (same case, or lowercase) loses.
 * - Aliases are lowercase and first-wins. A losing family's aliases still attach to the winner.
 * - Lookup: exact name, then lowercase name, then alias.
 *
 * RoleCall logs every alias collision at startup. Here they are data (`shadowedAliases`), pinned by
 * a test, so a new collision is a reviewed change instead of console noise.
 */
import type { MacroDefinition } from "./types";
import { CATALOG } from "./catalog";

const byName = new Map<string, MacroDefinition>();
const aliasTo = new Map<string, string>();
const shadowed: Array<{ alias: string; keptFor: string; droppedFor: string }> = [];

for (const def of CATALOG) {
  const key = def.name;
  if (!byName.has(key) && !byName.has(key.toLowerCase())) byName.set(key, def);
  const owner = byName.has(key) ? key : key.toLowerCase();
  for (const alias of def.aliases ?? []) {
    const lower = alias.toLowerCase();
    const kept = aliasTo.get(lower);
    if (kept === undefined) aliasTo.set(lower, owner);
    else shadowed.push({ alias: lower, keptFor: kept, droppedFor: owner });
  }
}

/**
 * Nondeterministic families by canonical name (RoleCall's BUILTIN_VOLATILE_MACROS). A definition
 * can also mark itself `volatile`.
 */
const VOLATILE = new Set([
  "random", "pick", "roll", "dice", "range", "coinflip", "percent", "shuffle", "weighted",
  "time", "date", "weekday", "isodate", "isotime", "idle_duration",
  "season", "moonphase", "zodiac", "year", "month", "day", "datetimeformat", "timediff",
]);

export function getMacro(nameOrAlias: string): MacroDefinition | undefined {
  const exact = byName.get(nameOrAlias);
  if (exact) return exact;
  const lower = nameOrAlias.toLowerCase();
  const direct = byName.get(lower);
  if (direct) return direct;
  const owner = aliasTo.get(lower);
  return owner === undefined ? undefined : byName.get(owner);
}

export const hasMacro = (nameOrAlias: string): boolean => getMacro(nameOrAlias) !== undefined;

export function isVolatileMacro(nameOrAlias: string): boolean {
  const def = getMacro(nameOrAlias);
  if (def?.volatile) return true;
  return VOLATILE.has(def?.name ?? nameOrAlias.toLowerCase());
}

/** Every registered definition, once each, in registration order. */
export const getAllMacros = (): readonly MacroDefinition[] => [...byName.values()];

/** Aliases a later family also declared and lost, in registration order. */
export const shadowedAliases = (): ReadonlyArray<{ alias: string; keptFor: string; droppedFor: string }> => shadowed;
