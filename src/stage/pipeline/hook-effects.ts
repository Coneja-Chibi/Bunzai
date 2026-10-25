/**
 * Checks a hook's effect against its powers before the pipeline applies any of it
 * (Decision 3). An effect with any problem is rejected whole, so a
 * hook can never half-apply. Pure.
 */
import {
  DEPTH_POSITIONS,
  type HookContexts,
  type HookEffects,
  type Placement,
  type PromptHookPoint,
} from "../contracts/pipeline";

export type EffectCheck = { ok: true } | { ok: false; problems: string[] };

function checkPlacements(hookId: string, placements: readonly Placement[], problems: string[]): void {
  const ids = new Set<string>();
  for (const p of placements) {
    const where = `placement ${JSON.stringify(p.id)}`;
    if (!p.id) problems.push("a placement has no id");
    else if (ids.has(p.id)) problems.push(`${where} is listed twice`);
    ids.add(p.id);
    if (p.source.kind !== "hook" || p.source.hookId !== hookId) {
      problems.push(`${where} must name this hook (${hookId}) as its source`);
    }
    const needsDepth = DEPTH_POSITIONS.has(p.position);
    if (needsDepth && !(Number.isInteger(p.depth) && (p.depth ?? -1) >= 0)) {
      problems.push(`${where} at ${p.position} needs a whole-number depth of 0 or more`);
    }
    if (!needsDepth && p.depth !== undefined) problems.push(`${where} at ${p.position} cannot take a depth`);
    if (!Number.isFinite(p.priority)) problems.push(`${where} needs a finite priority`);
  }
}

function unknown(label: string, asked: readonly string[] | undefined, known: ReadonlySet<string>, problems: string[]): void {
  for (const id of asked ?? []) if (!known.has(id)) problems.push(`${label} ${JSON.stringify(id)} does not exist`);
}

/** Every problem with one hook's effect, in the context it ran in. Empty means it may be applied. */
export function checkHookEffect<P extends PromptHookPoint>(
  hookId: string,
  point: P,
  context: HookContexts[P],
  effect: HookEffects[P],
): EffectCheck {
  const problems: string[] = [];
  switch (point) {
    case "before-assembly": {
      const c = context as HookContexts["before-assembly"];
      const e = effect as HookEffects["before-assembly"];
      unknown("preset prompt", Object.keys(e.promptStates ?? {}), new Set(Object.keys(c.promptStates)), problems);
      unknown("lorebook", e.excludeLorebookIds, new Set(c.lorebookIds), problems);
      break;
    }
    case "after-lorebook": {
      const c = context as HookContexts["after-lorebook"];
      const e = effect as HookEffects["after-lorebook"];
      checkPlacements(hookId, e.placements ?? [], problems);
      unknown("matched entry", e.dropEntryIds, new Set(c.matched.map((m) => m.placement.source.entryId)), problems);
      break;
    }
    case "shape-history": {
      const c = context as HookContexts["shape-history"];
      const e = effect as HookEffects["shape-history"];
      const known = new Set(c.history.map((m) => m.id));
      const replaced = (e.replace ?? []).map((r) => r.id);
      unknown("history message", e.dropIds, known, problems);
      unknown("history message", replaced, known, problems);
      const newest = c.history[c.history.length - 1]?.id;
      if (newest !== undefined && (e.dropIds?.includes(newest) || replaced.includes(newest))) {
        problems.push("the newest message cannot be dropped or replaced");
      }
      const dropped = new Set(e.dropIds ?? []);
      for (const id of replaced) if (dropped.has(id)) problems.push(`history message ${JSON.stringify(id)} is both dropped and replaced`);
      break;
    }
    case "before-send": {
      const e = effect as HookEffects["before-send"];
      if (e.veto && !e.veto.reason.trim()) problems.push("a veto needs a reason the user can read");
      break;
    }
  }
  return problems.length ? { ok: false, problems: problems.map((p) => `hook ${hookId} at ${point}: ${p}`) } : { ok: true };
}
