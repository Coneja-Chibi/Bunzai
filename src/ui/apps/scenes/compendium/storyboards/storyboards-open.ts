/**
 * How a Storyboard Prop's gear opens its dossier: the World wing's Compendium, on the Storyboards tab, on that dossier (RoleCall opens its Storyboards wing from a
 * rail icon). The gear sits in the Props wing, so the page opens the World wing (use-stage-open.ts answers the event) and each level, as it mounts,
 * reads the one pending request: the World wing picks its Compendium tab, the Compendium its Storyboards tab, the hub its dossier, which clears it.
 * A request nobody picks up expires after five seconds, so a book that never loads cannot leave one to jump a later open.
 */
import type { DossierType } from "../../../../../core/compendium/dossiers";

export const STORYBOARDS_OPEN_EVENT = "bunzai:storyboards-open";
const EXPIRES_MS = 5000;
let pending: { type: DossierType; at: number } | null = null;

export function openStoryboards(type: DossierType): void {
  pending = { type, at: Date.now() };
  window.dispatchEvent(new CustomEvent(STORYBOARDS_OPEN_EVENT));
}
export const pendingStoryboards = (): DossierType | null => (pending && Date.now() - pending.at < EXPIRES_MS ? pending.type : null);
export const clearStoryboards = (): void => { pending = null; };
