/**
 * The Compendium Activity feed as a pop-out kind (RoleCall's floating "Compendium Activity" panel, `LorebookActivityFeed.tsx:747-842`).
 * The same feed docked in the Activity tab and floating over the scene: each copy reads the receipts, the scene's books (to know
 * which library changes to watch) and the replies' recall traces itself, so the floating one works with the World wing shut.
 */
import type { JSX } from "react";
import { useSceneLore } from "../use-scene-lore";
import type { PopoutContext, PopoutKind } from "../popout/popout-kind";
import { ActivityTab } from "./tabs/activity";
import { useCompendiumReceipts } from "./use-compendium-receipts";
import { useRecallRows } from "./use-recall-rows";

function ActivityPane({ ctx, chat, id, popOut }: PopoutContext): JSX.Element {
  const { lore } = useSceneLore(ctx, chat.id);
  const feed = useCompendiumReceipts(ctx, chat.id, lore.state === "ready" ? lore.books.filter((b) => !b.missing).map((b) => b.id) : []);
  const recall = useRecallRows(ctx, chat);
  return <ActivityTab ctx={ctx} chatId={chat.id} feed={feed} extra={recall.rows} {...(recall.why ? { extraWhy: recall.why } : {})} {...(popOut ? { pop: { id, open: popOut } } : {})} />;
}

export const activityPopout: PopoutKind = {
  id: "compendium.activity",
  title: "Compendium Activity",
  noun: "Activity feed",
  icon: "lucide:zap",
  render: (c) => <ActivityPane {...c} />,
};
