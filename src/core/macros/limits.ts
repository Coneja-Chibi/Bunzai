/**
 * The engine's bounds (ADR-012 "Constraints on the evaluator"), in one place so handlers that build
 * strings ({{repeat}}, {{pad}}) can refuse an oversized result before allocating it, not after.
 */

/** Deepest nesting evaluated; deeper subtrees render "" (RoleCall's limit). */
export const MAX_EVAL_DEPTH = 100;

/** The longest string any node, handler, or run may produce. */
export const MAX_OUTPUT_CHARS = 1_000_000;

/** How often (in nodes) a run checks its deadline: internal tuning, so the clock is not read on every node. */
export const DEADLINE_CHECK_EVERY = 64;

/** Nodes evaluated in one run, so a wide template cannot stand in for a deep one. */
export const MAX_EVAL_STEPS = 1_000_000;
