/**
 * A Storyboard's card line. Its data is the AI Context profile and its context is the include switch (chat-tracker-types.ts), so the line says what the AI is sent:
 * the profile's mode, or that the dossier is left out. `defaultOn` is the dossier's default while no choice is stored (on for Quest Board and Cast, off for Map and Renown).
 */
import { normalizeProfile, profileLabel } from "../../../../../../core/compendium/dossiers/base";
import type { TrackerContext } from "../../../../../../stage/contracts/chat-store";

export function summaryLine(defaultOn: boolean): (data: unknown, context?: TrackerContext) => string {
  return (data, context) => {
    if (context === "never" || (context === undefined && !defaultOn)) return "Not sent to the AI";
    return `Sent to the AI · ${profileLabel(normalizeProfile(data).mode)}`;
  };
}
