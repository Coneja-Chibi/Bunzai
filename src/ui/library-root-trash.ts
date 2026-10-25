/** The library-open Trash purge (D23), kept separate from the resource-acquisition lifecycle. */
import { CUT_MESSAGE_TRASH_DAYS, TRASH_DAYS, trashCutoff } from "../core/trash-window";
import type { LibraryStores } from "../studio/library-content";

/** Deleted pieces, scenes, and takes older than TRASH_DAYS, and cut messages older than CUT_MESSAGE_TRASH_DAYS, are gone for good on each open. */
export async function emptyTrash({ content, chats }: LibraryStores): Promise<void> {
  const now = Date.now();
  const before = trashCutoff(now, TRASH_DAYS);
  const cutBefore = trashCutoff(now, CUT_MESSAGE_TRASH_DAYS);
  for (const [what, purge] of [["pieces", () => content.purge(before)], ["scenes, takes, and cut messages", () => chats.purgeChats(before, cutBefore)]] as const) {
    try {
      const n = await purge();
      if (n > 0) console.log(`library: emptied ${n} ${what} from the Trash (older than ${TRASH_DAYS} days, cut messages ${CUT_MESSAGE_TRASH_DAYS})`);
    } catch (e) {
      console.error(`library: could not empty the Trash of ${what}; trying again next open:`, e);
    }
  }
}
