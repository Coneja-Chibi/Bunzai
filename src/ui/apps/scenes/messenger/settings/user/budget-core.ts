/**
 * The two time budgets in Settings (approved wireframe premiere/scene-pieces.html, section 4): how long all of a reply's tool calls may take together (`scenes.toolBudgetMs`) and how long all the
 * macros of one prompt build may take (`scenes.promptBudgetMs`). They are stored in milliseconds and shown in seconds. The studio reads a saved value only when it is a positive finite number
 * (ui/server-scene-readers.ts), so the box accepts exactly that and nothing else; there is no ceiling (owner rule: no product cap).
 */
import { PROMPT_BUDGET_MS_DEFAULT, TOOL_BUDGET_MS_DEFAULT } from "../../../../../../core/assembly/tool-rounds";
import { MS_PER_SECOND, SETTING_KEYS, budgetMsOf } from "../../../../../../studio/settings-shape";

export interface BudgetDef { key: string; label: string; description: string; defaultMs: number }

export const BUDGETS: readonly BudgetDef[] = [
  { key: SETTING_KEYS.toolBudgetMs, label: "Tools, per reply", defaultMs: TOOL_BUDGET_MS_DEFAULT,
    description: "How long the narrator's tools may run in one reply. When it runs out, slow tools are told to stop and the reply goes on; tracker updates always land." },
  { key: SETTING_KEYS.promptBudgetMs, label: "Building the prompt", defaultMs: PROMPT_BUDGET_MS_DEFAULT,
    description: "How long macros may take while a request is built. A macro that runs out is left out and named under the reply; the rest is sent." },
];

/** The budget a saved value stands for, in seconds as the box shows it: the saved number when it is positive and finite, else the default. */
export const secondsShown = (saved: unknown, defaultMs: number): string => String((budgetMsOf(saved) ?? defaultMs) / MS_PER_SECOND);

/** What was typed, in milliseconds; null for an empty box, anything that is not a number, zero and a negative one (nothing is saved for those). */
export function msTyped(text: string): number | null {
  const seconds = text.trim() === "" ? Number.NaN : Number(text);
  return budgetMsOf(seconds * MS_PER_SECOND) ?? null;
}
