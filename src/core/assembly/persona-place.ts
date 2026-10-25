/**
 * Where the persona's stored Prompt Injection stop puts it (the Persona tab's World, Scene and Depth). Character, unset and every
 * other stop leave the persona in the assembler's own `{{persona}}` block. A preset block that already carries `{{persona}}` also
 * wins, which is why the tab locks the stops then. A moved persona is one block, placed with the lore machinery: World pins it
 * ahead of every pin, Scene seats it after the scenario block, Depth joins the depth notes (lore-place.ts, the history cut).
 */
import type { PersonaChatInjection } from "../../entities/persona/schema";
import type { Block } from "./conversation";
import { findFirst, findLast } from "./lore-place";
import type { PresetPlan } from "./preset";

/** The stops this version moves; a wrong or foreign stop stays where the macro puts it. */
export const personaMoves = (injection: PersonaChatInjection | undefined): boolean =>
  injection?.position === "world" || injection?.position === "scene" || injection?.position === "depth";

const DEPTH_DEFAULT = 2;

/** Places `text` (the persona block, macros not yet expanded) into the plan and the depth-note map for a moving stop. */
export function placePersona(plan: PresetPlan, depthNotes: Map<number, Block[]>, text: string, injection: PersonaChatInjection): void {
  const source = { kind: "prompt", name: "Persona", id: "personaInjected" } as const;
  if (injection.position === "depth") {
    const depth = Number.isFinite(injection.depth) ? Math.max(0, Math.min(100, Math.floor(injection.depth!))) : DEPTH_DEFAULT;
    depthNotes.set(depth, [...(depthNotes.get(depth) ?? []), { role: injection.role ?? "system", content: text, source }]);
  } else if (injection.position === "world") {
    plan.top.unshift({ role: "system", content: text, source });
  } else {
    const scenario = findFirst(plan.relative, ["scenario"]);
    const card = findLast(plan.relative, ["charDescription", "charPersonality"]);
    plan.relative.splice(scenario >= 0 ? scenario + 1 : card >= 0 ? card + 1 : 0, 0, { role: "system", content: text, source });
  }
}
