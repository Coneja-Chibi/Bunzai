/**
 * Human text for a LoreVerdict (2e), shared by Rehearsal and the
 * entry rail so the Workbench describes a verdict the same way everywhere. `entry` supplies fields
 * the verdict itself doesn't carry (selectiveLogic) and may be omitted where it isn't at hand.
 */
import type { LoreVerdict } from "../../../../core/lore";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";

export function loreVerdictText(v: LoreVerdict, entry?: LorebookEntry): string {
  const d = v.detail;
  switch (v.reason) {
    case "constant":
      return "always on";
    case "key":
      return v.matched.length ? `matched "${v.matched.join(", ")}"` : "key match";
    case "secondary":
      return v.matched.length ? `matched "${v.matched.join(", ")}" with secondary keys` : "matched with secondary keys";
    case "special":
      return v.matched.length ? `special trigger ${v.matched[0]}` : "special trigger";
    case "emotion":
      return v.matched.length ? `emotion trigger ${v.matched[0]}` : "emotion trigger";
    case "sticky":
      return `sticky${d?.remaining === undefined ? "" : `, ${d.remaining} left`}`;
    case "recursion":
      return v.matched.length
        ? `woken by another entry via "${v.matched.join(", ")}"`
        : "woken by another entry";
    case "disabled":
      return "off";
    case "no-key-match":
      return "no key hit";
    case "secondary-logic":
      return `secondary keys failed${entry ? ` (${entry.selectiveLogic})` : ""}`;
    case "frequency":
      return "its trigger is still in its own frequency window";
    case "chance":
      return d?.rolled === undefined
        ? `the ${d?.needed ?? 0}% chance did not roll`
        : `the ${d?.needed ?? 0}% chance rolled ${d.rolled}`;
    case "cooldown":
      return `cooling down${d?.remaining === undefined ? "" : `, ${d.remaining} left`}`;
    case "delay":
      return d?.remaining === undefined
        ? "waits for more messages"
        : `waits ${d.remaining} more message${d.remaining === 1 ? "" : "s"}`;
    case "budget-cut":
      return `cut by budget (would cost ${d?.cost ?? v.tokens}${d?.left === undefined ? "" : `, ${d.left} left`})`;
    case "exclude-recursion":
      return "cannot be woken by recursion";
    case "delay-until-recursion":
      return `waits for recursion level ${d?.remaining ?? "?"}`;
    case "empty-keys":
      return "no keys";
    case "character-filter":
      return "not for this character";
    case "group-lost":
      return "lost its inclusion group";
    default:
      return "skipped";
  }
}
