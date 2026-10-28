/**
 * Max tool rounds (RoleCall's Control Booth "Max tool rounds", QuickPlayPanel.tsx:2128-2149; clamped 1 to 20 in
 * lib/scene/stage-settings-persistence.ts:183-184, default 8): how many rounds of tool calls the narrator gets in one reply.
 * One set for the store's check, the Booth's control and the turn.
 */
export const TOOL_ROUNDS_MIN = 1;
export const TOOL_ROUNDS_MAX = 20;
export const TOOL_ROUNDS_DEFAULT = 8;

/**
 * The time (ms) all of one reply's tool calls may take together: the tool loop hands each run what is left, and a run that passes it stops
 * (a formula) or is not started. The scene-wide setting `scenes.toolBudgetMs` (Settings > Studio > Time budgets) overrides this default.
 */
export const TOOL_BUDGET_MS_DEFAULT = 5_000;

/**
 * The time (ms) all the macros of one prompt build may take together (a card, a preset, a template, a tracker's text): the macro passes are given
 * it as a deadline, and when it is spent the macro in hand ends with an error that lands in the turn's macro report while the prompt still builds.
 * Normal prompts take a few milliseconds, so this guards a hostile card or a runaway template. The scene-wide setting `scenes.promptBudgetMs`
 * (Settings > Studio > Time budgets) overrides it.
 */
export const PROMPT_BUDGET_MS_DEFAULT = 3_000;
