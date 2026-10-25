/**
 * The ten Story Director personalities, in the order RoleCall's picker shows them (`dm/personalities/index.ts`), and the shared footer every one of them is rendered with. An unknown or
 * absent id is Sage, `the-balanced`: RoleCall's `getDefaultPersonality` answers the Weaver, but its settings and picker default to Sage, and a scene that never chose one has chosen Sage.
 */
import type { DirectorPersonality } from "../../../stage/contracts/director-types";
import { THE_ARCHITECT } from "./the-architect";
import { THE_BALANCED } from "./the-balanced";
import { THE_CHRONICLER } from "./the-chronicler";
import { THE_ENIGMA } from "./the-enigma";
import { THE_JESTER } from "./the-jester";
import { THE_ORACLE } from "./the-oracle";
import { THE_ROMANTIC } from "./the-romantic";
import { THE_SHADOW } from "./the-shadow";
import { THE_THRILL_SEEKER } from "./the-thrill-seeker";
import { THE_WEAVER } from "./the-weaver";
import type { DirectorPersonalityDef } from "./types";

export type { DirectorPersonalityDef } from "./types";

export const PERSONALITIES: readonly DirectorPersonalityDef[] = [THE_WEAVER, THE_ARCHITECT, THE_ORACLE, THE_ROMANTIC, THE_THRILL_SEEKER, THE_SHADOW, THE_JESTER, THE_ENIGMA, THE_CHRONICLER, THE_BALANCED];
export const DEFAULT_PERSONALITY: DirectorPersonality = "the-balanced";

export function personalityOf(id: string | null | undefined): DirectorPersonalityDef {
  return PERSONALITIES.find((p) => p.id === id) ?? THE_BALANCED;
}

/**
 * Appended to every personality's block (RoleCall `SHARED_PERSONALITY_GUIDANCE`): the personalities describe a lane, not a script, and flavor delivery, never the story's register.
 */
export const SHARED_PERSONALITY_GUIDANCE = `

---

### Vary Within Your Lane (Anti-Repetition)
Do not reuse the same beats, phrasings, NPC behaviors, atmospheres, or "signature" devices turn-to-turn. The arcs, tropes, and examples above describe your *tendencies and flavor* - they are not a checklist to replay or a fixed set of moves to cycle through. Vary your choices within your personality's lane; choose freshness over formula every turn.

### Personality Flavors Delivery, Never Register
Your personality flavors the DELIVERY; it never overrides the story's primary register/genre. Even a darker/edgier personality defers to an erotic/romance/slice-of-life register - flavor it, don't convert it. Stay in the story's lane and color it with your voice.`;

/** A personality's block of the planner's system prompt: its own text, then the shared footer. */
export const personalityPrompt = (id: string | null | undefined): string => personalityOf(id).buildSystemPrompt() + SHARED_PERSONALITY_GUIDANCE;
