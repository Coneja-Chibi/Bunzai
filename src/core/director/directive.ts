/**
 * What happens to a directive between the planner and the narrator (RoleCall `DirectiveBuilder.ts` enrichDirectiveFromMomentum and sanitizeDirectiveForPlayerCharacter, run in
 * that order at `worker.ts:3973-3983`): overdue arcs and ripe seeds the planner left out are added so the pressure reaches the prose, and every entry that claims the player's
 * interiority is cut, because the narrator may stage the player but never think, feel or decide for them. Pure; the rendering is core/assembly/director.ts.
 */
import { escapeRegex } from "../regex/escape";
import type { NarratorDirective } from "../../stage/contracts/director-types";
import type { MomentumReport } from "./momentum";

/** Adds a forceful arc direction for each forced arc and a callback for each ripe seed that the directive does not already name. */
export function enrichFromMomentum(directive: NarratorDirective, report: MomentumReport | undefined): NarratorDirective {
  if (!report || (report.forcedActions.length === 0 && report.ripeSeeds.length === 0)) return directive;
  const out: NarratorDirective = { ...directive };
  if (report.forcedActions.length > 0) {
    const named = new Set((out.arcDirections ?? []).map((a) => a.arcName.toLowerCase().trim()));
    const arcDirections = [...(out.arcDirections ?? [])];
    for (const forced of report.forcedActions) {
      const key = forced.name.toLowerCase().trim();
      if ([...named].some((n) => n === key || n.includes(key) || key.includes(n))) continue;
      arcDirections.push({
        arcName: forced.name, urgency: "forceful",
        instruction: `This arc is OVERDUE (${forced.turnsActive} turns without progression, ${forced.overdueBy} past the limit). Deliver a turning point that pushes it toward climax/resolution this scene, OR write a beat that brings it to a natural close. Do not leave it to drift another turn - the audience can feel arcs that have stalled.`,
      });
      named.add(key);
    }
    if (arcDirections.length > (out.arcDirections?.length ?? 0)) out.arcDirections = arcDirections;
  }
  if (report.ripeSeeds.length > 0) {
    const refs = (out.callbacks ?? []).map((c) => c.reference.toLowerCase());
    const callbacks = [...(out.callbacks ?? [])];
    for (const seed of report.ripeSeeds) {
      const hint = seed.name.toLowerCase().trim();
      if (!hint || refs.some((r) => r.includes(hint) || hint.includes(r))) continue;
      callbacks.push({
        reference: seed.name,
        instruction: `RIPE SEED - echo this in prose this scene. A passing reference, an environmental cue, an NPC line, or a small detail that quietly reinforces it. Planted ${seed.turnsPlanted} turns ago, reinforced ${seed.reinforcements}x - it's ready to land.`,
      });
      refs.push(hint);
    }
    if (callbacks.length > (out.callbacks?.length ?? 0)) out.callbacks = callbacks;
  }
  return out;
}

// Verbs that claim the player's inner life: cognition, memory, perception, emotion, volition, reflection. Staging verbs (find, place, enter, reach) are deliberately absent.
const INTERIORITY_VERBS = [
  "think", "thinks", "thinking", "thought", "wonder", "wonders", "wondering", "wondered", "consider", "considers", "considering", "considered", "realize", "realizes", "realizing", "realized",
  "understand", "understands", "understanding", "understood", "recognize", "recognizes", "recognizing", "recognized", "know", "knows", "knowing", "knew", "suspect", "suspects", "suspecting", "suspected",
  "believe", "believes", "believing", "believed", "doubt", "doubts", "doubting", "doubted", "contemplate", "contemplates", "contemplating", "contemplated", "ponder", "ponders", "pondering", "pondered",
  "remember", "remembers", "remembering", "remembered", "recall", "recalls", "recalling", "recalled", "reminisce", "reminisces", "reminiscing", "reminisced",
  "notice", "notices", "noticing", "noticed", "sense", "senses", "sensing", "sensed", "perceive", "perceives", "perceiving", "perceived", "intuit", "intuits", "intuiting", "intuited",
  "feel", "feels", "feeling", "felt", "experience", "experiences", "experiencing", "experienced", "fear", "fears", "fearing", "feared",
  "want", "wants", "wanting", "wanted", "hope", "hopes", "hoping", "hoped", "trust", "trusts", "trusting", "trusted", "decide", "decides", "deciding", "decided", "choose", "chooses", "choosing", "chose",
  "process", "processes", "processing", "processed", "reflect", "reflects", "reflecting", "reflected",
].join("|");

/** Cuts every entry that names the player as the one who thinks, feels, notices, remembers or decides, or that gives the player a beat or a line. */
export function sanitizeForPlayerCharacter(directive: NarratorDirective, playerName: string | undefined): NarratorDirective {
  const name = playerName?.trim();
  if (!name) return directive;
  const alt = escapeRegex(name);
  // Word edges are Unicode-aware: a name that starts or ends with a non-ASCII letter (Élodie, a CJK name) is matched like any other.
  const L = String.raw`[\p{L}\p{N}_]`;
  const start = `(?<!${L})`;
  const stop = `(?!${L})`;
  const verbed = new RegExp(String.raw`${start}(?:have|let|make|show|let's have|push|force|prompt)\s+(?:${L}+\s+){0,2}(?:${alt})(?:['\u2019]?s)?\s+(?:${L}+\s+){0,3}(?:${INTERIORITY_VERBS})${stop}`, "iu");
  const bare = new RegExp(String.raw`${start}(?:${alt})\s+(?:${INTERIORITY_VERBS})${stop}`, "iu");
  const possessive = new RegExp(String.raw`${start}(?:${alt})['\u2019]?s\s+(?:thoughts?|mind|thinking|memor(?:y|ies)|feelings?|past|interiority|emotions?|perspective|consciousness|introspection|reflections?|reverie|intuition|suspicions?|beliefs?|doubts?|fears?|hopes?|desires?|inner\s+${L}+|methodical\s+${L}+)${stop}`, "iu");
  const isPlayer = (s: string | undefined): boolean => s !== undefined && s.trim().toLowerCase() === name.toLowerCase();
  const claims = (text: string | undefined): boolean => !!text && (verbed.test(text) || bare.test(text) || possessive.test(text));
  const out: NarratorDirective = { ...directive };
  if (out.characterBeats) out.characterBeats = out.characterBeats.filter((b) => !isPlayer(b.character) && !claims(b.beat) && !claims(b.motivation));
  if (out.dialogueGuidance) out.dialogueGuidance = out.dialogueGuidance.filter((d) => !isPlayer(d.character));
  if (out.include?.characters) {
    const characters = out.include.characters.filter((c) => !isPlayer(c));
    const { characters: _old, ...rest } = out.include;
    out.include = characters.length > 0 ? { ...rest, characters } : rest;
  }
  if (out.arcDirections) out.arcDirections = out.arcDirections.filter((a) => !claims(a.instruction));
  if (out.callbacks) out.callbacks = out.callbacks.filter((c) => !claims(c.instruction));
  return out;
}
