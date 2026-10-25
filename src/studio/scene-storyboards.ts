/**
 * Which books the Storyboard Props read for a turn (RoleCall's `buildDossierPromptContextSections` over `filterReadableLorebooks`): the scene's
 * lorebooks that are on and that the Compendium may read (access read-only or better; a write-only or disabled book is never read into the
 * prompt), as the entries the dossiers are built from. Nothing is returned when no Storyboard Prop is on, so a scene without them reads no entry.
 */
import { accessOf, canRead } from "../core/compendium/defaults";
import { readBook } from "../core/compendium/read";
import { isStoryboard } from "../core/trackers";
import type { StoryboardsInput } from "../core/assembly/storyboards";
import { TRACKER_PROP_PREFIX } from "../stage/contracts/chat-tracker-types";
import type { Chat } from "../stage/contracts/chat-store";
import type { LorebookBody } from "../entities/lorebook/schema";

export function storyboardsOf(chat: Chat, books: readonly { id: string; name: string; body: LorebookBody }[] | undefined): StoryboardsInput | undefined {
  const on = chat.props?.on ?? [];
  const wanted = on.some((id) => id.startsWith(TRACKER_PROP_PREFIX) && isStoryboard(id.slice(TRACKER_PROP_PREFIX.length) as never));
  if (!wanted || !books) return undefined;
  const readable = books.filter((b) => canRead(accessOf(chat.compendium, b.id))).map((b) => ({ name: b.name, entries: readBook(b.body.entries) }));
  return readable.length === 0 ? undefined : { books: readable, entries: chat.trackers ?? {}, on };
}
