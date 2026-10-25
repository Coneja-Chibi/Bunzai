/**
 * Declarative variable mutations for injecting entries. Ported from RoleCall's runtime/
 * side-effects.ts, but the engine never resolves a final value: it returns
 * add/inc/dec as deltas (LoreScan says as much - "side effects are returned, not applied"), so the
 * caller applies them against its own local/global stores without the engine needing to read or
 * merge those namespaces itself. `onlyOnFirstTrigger` and `clearOnDeactivate` are derived from the
 * fire history (TimersIndex.everFired / .activeLastTurn) rather than RoleCall's stateful
 * SideEffectsTracker.
 */
import type { EntrySideEffect } from "../../../entities/lorebook/schema";
import { entryKey, type EntryRef, type LoreSideEffectOp } from "./types";
import type { TimersIndex } from "./timers";

function effectToOp(effect: EntrySideEffect): LoreSideEffectOp {
  switch (effect.type) {
    case "setvar":
      return { op: "set", name: effect.variable, value: effect.value ?? "", scope: effect.scope };
    case "addvar":
      return { op: "add", name: effect.variable, value: effect.value ?? "", scope: effect.scope };
    case "incvar":
      return { op: "inc", name: effect.variable, value: effect.amount ?? 1, scope: effect.scope };
    case "decvar":
      return { op: "dec", name: effect.variable, value: effect.amount ?? 1, scope: effect.scope };
    case "delvar":
      return { op: "del", name: effect.variable, scope: effect.scope };
  }
}

/**
 * `allEntries` is every candidate considered this turn (enabled + character-filter-passed), used
 * only to find entries that deactivated - fired last turn but aren't injecting this turn - and
 * still exist to read their `clearOnDeactivate` effects from. `injecting` is this turn's survivors,
 * in final placement order.
 */
export function resolveSideEffects(
  allEntries: readonly EntryRef[],
  injecting: readonly EntryRef[],
  timers: TimersIndex,
): LoreSideEffectOp[] {
  const ops: LoreSideEffectOp[] = [];
  const injectingKeys = new Set(injecting.map((r) => entryKey(r.book.id, r.entry.id)));

  for (const ref of allEntries) {
    const key = entryKey(ref.book.id, ref.entry.id);
    if (!timers.activeLastTurn.has(key) || injectingKeys.has(key)) continue;
    const sideEffects = ref.entry.sideEffects;
    if (!sideEffects?.clearOnDeactivate) continue;
    for (const effect of sideEffects.effects) {
      if (effect.type === "delvar") continue;
      ops.push({ op: "del", name: effect.variable, scope: effect.scope });
    }
  }

  for (const ref of injecting) {
    const sideEffects = ref.entry.sideEffects;
    if (!sideEffects || sideEffects.effects.length === 0) continue;
    const key = entryKey(ref.book.id, ref.entry.id);
    if (sideEffects.onlyOnFirstTrigger && timers.everFired.has(key)) continue;
    for (const effect of sideEffects.effects) ops.push(effectToOp(effect));
  }

  return ops;
}
