/**
 * The Storyboards' block of the request (RoleCall `prompt-assembly.ts:2136-2146,2600-2610`, `dossiers/prompt-context.ts`): for each Storyboard Prop that
 * is on and included, the dossier's digest of the books the scene reads, as one system message headed "[COMPENDIUM STORYBOARDS CONTEXT]", after the
 * trackers' block and in front of the conversation. A dossier with nothing in it sends nothing.
 *
 * Two named differences from RoleCall. It joins the book's `world` text (the `{{lore}}` position) there; here it is its own block, so the Tokens sheet
 * can show what it cost and a preset with no `{{lore}}` still sends it. And RoleCall's empty dossiers still send their "[USE]" boilerplate; here they
 * send nothing.
 */
import { TRACKER_PROP_PREFIX, type ChatTrackers } from "../../stage/contracts/chat-tracker-types";
import { DOSSIER_TYPES, normalizeProfile, storyboardsText, type StoryboardSource } from "../compendium/dossiers";
import { contextDue, storyboardIncludedByDefault } from "../trackers";

export interface StoryboardsInput {
  /** The books the scene may read (access read-only or better), their entries as the Compendium reads them. */
  books: readonly StoryboardSource[];
  entries: ChatTrackers;
  /** The scene's switched-on Props (rule 21). */
  on: readonly string[];
}

/** The block's text for this turn, or "" when nothing is on, included or worth sending. `turn` counts the user messages including the one being answered. */
export function storyboardsBlock(input: StoryboardsInput | undefined, turn: number): string {
  if (!input || input.books.length === 0) return "";
  const asked = DOSSIER_TYPES.filter((type) => {
    if (!input.on.includes(`${TRACKER_PROP_PREFIX}${type}`)) return false;
    const context = input.entries[type]?.context;
    return context === undefined ? storyboardIncludedByDefault(type) : contextDue(context, turn);
  }).map((type) => ({ type, profile: normalizeProfile(input.entries[type]?.data) }));
  return storyboardsText(input.books, asked);
}
