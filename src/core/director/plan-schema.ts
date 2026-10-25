/**
 * The planning command's argument schemas, copied from RoleCall's `commit_planning_round` (`dm-stream/tools/commit-planning-round.ts`) word for word. The only differences: em dashes are
 * hyphens (the repo bans them in source), comments about RoleCall's other providers are dropped, and `dossierUpdatesNeeded` is gone - the Storyboards' focused rounds are a later slice
 * (plan 15, SD-3), and a field nothing reads would only cost the planner tokens.
 */
const directiveSchema = {
  type: "object",
  required: ["mood", "pacing"],
  properties: {
    mood: {
      type: "string",
      description:
        "Current emotional tone of the scene - free-form but concise (e.g. 'tense', 'melancholy', 'playful unease').",
    },
    pacing: {
      type: "string",
      enum: ["slow", "medium", "fast", "breakneck"],
      description: "How quickly the next beat should unfold.",
    },
    include: {
      type: "object",
      description: "Concrete material the narrator SHOULD weave into this turn's prose. Almost every turn has at least one entry across these sub-fields - they're how you steer texture, not whether to.",
      properties: {
        characters: { type: "array", items: { type: "string" }, description: "NPC names the narrator should bring on-stage or keep present this turn." },
        themes: { type: "array", items: { type: "string" }, description: "Thematic threads worth surfacing this turn (e.g. 'discipline gap', 'mentorship testing', 'loneliness of command')." },
        sensoryDetails: { type: "array", items: { type: "string" }, description: "Concrete sensory anchors the narrator should drop in - a smell, a sound, the texture of a surface. These prevent generic prose." },
        foreshadowing: { type: "array", items: { type: "string" }, description: "Hints to plant for future payoffs - a brief odd phrase, an out-of-place mark, a name dropped in passing. Tie to a relatedArcId in your seedUpdates if planting a new seed." },
      },
    },
    avoid: {
      type: "object",
      description: "What the narrator should NOT surface this turn - kept secret, off-limits, or saved for later beats.",
      properties: {
        topics: { type: "array", items: { type: "string" }, description: "Topics the narrator must not raise this turn (e.g. 'future plot twists', 'NPC's hidden motive')." },
        characters: { type: "array", items: { type: "string" }, description: "NPCs who should stay off-screen this turn." },
        revelations: { type: "array", items: { type: "string" }, description: "Specific secrets/identities/agendas to hold back this turn." },
      },
    },
    dialogueGuidance: {
      type: "array",
      description: "Per-NPC voice direction. For every NPC who has speakable lines this turn, give the narrator a tone read and (when useful) specific hint phrases the NPC's voice should land. Without this, dialogue drifts toward generic affect.",
      items: {
        type: "object",
        required: ["character", "tone"],
        properties: {
          character: { type: "string", description: "NPC name." },
          tone: { type: "string", description: "Short tonal read - 'measured cold focus with strain under it', 'controlled bitterness', 'wry tenderness'." },
          hints: { type: "array", items: { type: "string" }, description: "Specific line shapes or phrases the NPC's voice should produce - 'speaks in training commands', 'one off-hand formal instruction'." },
        },
      },
    },
    sceneGuidance: {
      type: "object",
      description: "Where the scene is AND its physical/emotional texture. Fill this almost every turn - even when the location hasn't changed, atmosphere and tension level shift turn-to-turn.",
      properties: {
        setting: { type: "string", description: "Concrete location - 'stone courtyard by the eastern wall practice posts', not 'the courtyard'." },
        atmosphere: { type: "string", description: "The room/space's emotional weather - 'tight air after sparring, everyone pretending it's routine'." },
        tension_level: { type: "number", description: "0-10 scale. Calibrate so the narrator paces tone correctly. 6+ should produce noticeable strain in the prose." },
      },
    },
    endingHook: { type: "string", description: "What specific moment should END this turn's narrator output - a glance, a sound, an unfinished question. The hook should make the next player input feel inevitable. Don't skip this; an ending without a hook reads as fade-out." },
    arcDirections: {
      type: "array",
      description: "Per-arc nudge to the narrator. For every ACTIVE arc the player is engaging with this turn, give the narrator one specific instruction that moves the arc forward in the prose.",
      items: {
        type: "object",
        required: ["arcName", "instruction", "urgency"],
        properties: {
          arcName: { type: "string", description: "Active arc's title or slug." },
          instruction: { type: "string", description: "What the narrator should DO this turn that moves the arc - 'have Lyra stop the sparring tempo and give a specific footwork drill', not 'show training'." },
          urgency: { type: "string", enum: ["subtle", "moderate", "forceful"], description: "How loudly the arc beat lands. 'subtle' = background hum, 'moderate' = noticeable nudge, 'forceful' = the arc is the spine of this turn." },
        },
      },
    },
    callbacks: {
      type: "array",
      description: "References to earlier moments the narrator should echo this turn - a memory, a phrase, an object. Callbacks are how the story feels woven instead of episodic. Aim for at least one every few turns.",
      items: {
        type: "object",
        required: ["reference", "instruction"],
        properties: {
          reference: { type: "string", description: "What earlier moment is being called back - 'Brynn's earlier comment about her father', 'the rusted bell on turn 7'." },
          instruction: { type: "string", description: "How the narrator should land the callback - 'have it surface as a half-finished thought during Lyra's correction'." },
        },
      },
    },
    characterBeats: {
      type: "array",
      description: "Per-NPC internal beat the narrator should show through action or implication. Distinct from dialogueGuidance - this is what the NPC is internally DOING or feeling, not how they speak.",
      items: {
        type: "object",
        required: ["character", "beat"],
        properties: {
          character: { type: "string", description: "NPC name." },
          beat: { type: "string", description: "The internal beat - 'Lyra weighing whether to reveal her real reason for taking Kai on', 'Brynn fighting the urge to throw the drill blade'." },
          motivation: { type: "string", description: "Optional one-phrase why behind the beat - 'pride she won't admit', 'old wound from training under her father'." },
        },
      },
    },
    narrativeGoal: { type: "string", description: "One-sentence read on what THIS TURN's prose should accomplish in the larger arc - 'establish Lyra's mentorship as both demanding and protective while letting Brynn's resentment sharpen visibly'." },
  },
};

const arcUpdateItemSchema = {
  type: "object",
  required: ["arcId"],
  properties: {
    arcId: { type: "string", description: "ID of the arc (from the active arcs list)" },
    title: { type: "string", description: "Short label (~3-6 words, max 80 chars). Only set if the arc was renamed. NO description content, NO 'Next Beat:' content, NO multi-line text - those go in description and nextBeat." },
    description: { type: "string", description: "Updated description reflecting what happened this turn" },
    status: {
      type: "string",
      enum: ["seeding", "building", "climax", "resolution", "complete", "abandoned"],
      description: "Updated status",
    },
    horizon: { type: "string", enum: ["immediate", "short", "medium", "long", "epic"] },
    priority: { type: "string", enum: ["background", "active", "urgent"] },
    newStageTitle: {
      type: "string",
      description:
        "New milestone title (only for important events, BACKWARD-LOOKING - describes what already happened this turn). MUST be paired with newStageDescription.",
    },
    newStageDescription: {
      type: "string",
      description: "REQUIRED when newStageTitle is set. Describe what happened, who was involved, and why it matters.",
    },
    markNextBeatDelivered: {
      type: "boolean",
      description: "Mark the arc's pending nextBeat as delivered when the narrator's prose THIS turn fulfilled it.",
    },
    nextBeat: {
      type: "object",
      description:
        "FORWARD-LOOKING plan for what should happen NEXT in this arc. Stages describe history; nextBeat describes future.",
      required: ["description"],
      properties: {
        description: {
          type: "string",
          description:
            "What the DM plans to push the narrator to deliver next. Be specific.",
        },
        targetTurn: {
          type: "number",
          description: "Optional rough target turn when this beat should land. Emit as number; string forms like '5' or 'in 3 turns' get coerced server-side.",
        },
      },
    },
  },
};

const seedUpdateItemSchema = {
  type: "object",
  required: ["title", "action", "scope", "relatedArcId"],
  properties: {
    id: { type: "string", description: "Existing stable seed ID from the seed list. Use it when titles repeat; omit for a new seed." },
    title: { type: "string", description: "Seed title (must match existing for reinforce/resolve, or new for plant)" },
    action: { type: "string", enum: ["plant", "reinforce", "resolve", "delete"] },
    scope: { type: "string", enum: ["world", "player"] },
    relatedArcId: { type: "string", description: "ID/title of related arc (use '' if none)" },
    description: {
      type: "string",
      description:
        "REQUIRED when action is 'plant' or when the existing seed has no description. The seed's full meaning, question, expected payoff. NOT the horizon.",
    },
    payoffHorizon: {
      type: "string",
      enum: ["immediate", "short", "medium", "long", "epic"],
      description: "For plant: when this seed should pay off",
    },
    reinforcement: {
      type: "string",
      description: "REQUIRED when action is 'reinforce'. How the seed was echoed this turn.",
    },
    outcome: {
      type: "string",
      description: "REQUIRED when action is 'resolve'. How the seed paid off.",
    },
  },
};

const invisibleArcUpdateItemSchema = {
  type: "object",
  required: [
    "title",
    "action",
    "description",
    "horizon",
    "surfaceCondition",
    "plannedBeats",
    "foreshadowingSeeds",
    "relatedVisibleArcs",
    "newClue",
    "newStageTitle",
    "newStageDescription",
  ],
  properties: {
    title: { type: "string" },
    arcId: { type: "string" },
    action: { type: "string", enum: ["add", "update", "surface", "resolve", "delete"] },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["seeding", "building", "approaching_player", "visible", "resolved"],
    },
    arcType: {
      type: "string",
      enum: ["faction", "npc_agenda", "world_event", "conspiracy", "background"],
    },
    horizon: { type: "string", enum: ["immediate", "short", "medium", "long", "epic"] },
    scope: { type: "string", enum: ["world", "player"] },
    surfaceCondition: { type: "string" },
    expectedSurfaceTurn: { type: "number" },
    plannedBeats: {
      type: "array",
      items: {
        type: "object",
        required: ["description"],
        properties: {
          description: { type: "string" },
          completed: { type: "boolean" },
          hidden: { type: "boolean" },
        },
      },
    },
    foreshadowingSeeds: { type: "array", items: { type: "string" } },
    newClue: { type: "string" },
    relatedVisibleArcs: { type: "array", items: { type: "string" } },
    newStageTitle: { type: "string" },
    newStageDescription: { type: "string" },
  },
};

const analysisSchema = {
  type: "object",
  properties: {
    whatHappened: {
      type: "string",
      description: "1-2 sentences: what actually happened this turn (the beats that landed in the prose).",
    },
    summary: { type: "string", description: "Optional alternative phrasing if 'whatHappened' is too narrow." },
    seedsPlanted: {
      type: "array",
      items: { type: "string" },
      description: "New foreshadowing seeds the narrator dropped this turn.",
    },
    seedsPaidOff: {
      type: "array",
      items: { type: "string" },
      description: "Seeds whose payoff actually delivered this turn.",
    },
    unexpected: {
      type: "array",
      items: { type: "string" },
      description: "Developments you didn't plan for - moments the player or narrator surprised you.",
    },
    pacingAnalysis: {
      type: "string",
      description: "1-2 sentences: current rhythm, whether the next turn wants action or quiet, what comes next.",
    },
    playerEnergy: {
      type: "string",
      description: "Optional read on the player's engagement this turn.",
    },
    intentions: {
      type: "array",
      description:
        "What you want to happen NEXT, with timeline. Each entry: { type, description, priority, targetTurn }.",
      items: {
        type: "object",
        required: ["description"],
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["must", "should", "could"] },
          targetTurn: { type: "string", enum: ["next", "soon", "eventually"] },
        },
      },
    },
    suggestedActions: {
      type: "array",
      items: { type: "string" },
      description: "Quick action suggestions to surface in the player's UI.",
    },
  },
};

const chapterUpdateSchema = {
  type: "object",
  required: ["action", "title"],
  properties: {
    action: {
      type: "string",
      enum: ["none", "update", "start_new"],
      description:
        "Choose start_new when no chapter exists or the story crossed a major boundary; update when the current chapter meaningfully evolved; otherwise none.",
    },
    title: {
      type: "string",
      description:
        "A concise title for the current or new chapter, without a Chapter N prefix. Required even for none so an empty legacy context can self-heal.",
    },
    description: { type: "string", description: "The current or new chapter premise." },
    status: {
      type: "string",
      enum: ["active", "concluding", "complete"],
      description: "Updated status when action is update.",
    },
    themes: { type: "array", items: { type: "string" } },
    objectives: { type: "array", items: { type: "string" } },
    tone: { type: "string" },
    closingMoment: {
      type: "string",
      description:
        "For update, how the current chapter should end; for start_new, how the previous chapter concluded.",
    },
  },
};

export { directiveSchema, arcUpdateItemSchema, seedUpdateItemSchema, invisibleArcUpdateItemSchema, analysisSchema, chapterUpdateSchema };
