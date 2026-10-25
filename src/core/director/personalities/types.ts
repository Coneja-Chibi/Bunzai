/**
 * The shape of one Story Director personality (RoleCall `dm/personalities/types.ts`): the picker's identity (name, title, tagline, description), the behavioral framework the picker shows
 * as style chips and beliefs, and the planning framework and system block the planner reads. No avatar and no accent color: the picker draws from theme tokens.
 */
export interface DirectorPersonalityDef {
  id: string;
  name: string;
  title: string;
  description: string;
  tagline: string;
  traits: {
    pacing: "slow" | "balanced" | "fast";
    drama: "subtle" | "moderate" | "high";
    romance: "minimal" | "moderate" | "focus";
    action: "minimal" | "moderate" | "focus";
    mystery: "minimal" | "moderate" | "focus";
    humor: "minimal" | "moderate" | "focus";
  };
  philosophy: {
    coreBeliefs: string[];
    improvisation: "rigid" | "adaptive" | "fluid";
    playerAgency: "guided" | "collaborative" | "freeform";
    informationControl: "tight" | "moderate" | "loose";
  };
  preferences: { favoriteArcs: string[]; signatureTropes: string[]; pacingRhythm: string; emotionalFocus: string[] };
  improvisation: { whenPlayerDiverts: string; whenPlanFails: string; backupPlanStrategy: string; yesAndPhilosophy: string };
  /** What never leaks to the narrator, and the safe and unsafe directive examples. */
  directiveSafety: { neverReveal: string[]; hintingStyle: string; moodGuidance: string; exampleSafeDirective: string; exampleUnsafeDirective: string };
  /** The chain-of-thought stages the planner works through before it commits. */
  planningFramework: string;
  buildSystemPrompt: () => string;
}
