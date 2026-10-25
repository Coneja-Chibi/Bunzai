/**
 * The Compendium wing with Track C's pieces mounted through the wing's own slots (mount ids `compendium.activity` and
 * `compendium.headerActions`, and `recentWrites` for the Dashboard): the Activity tab, the Reconcile button and the receipts'
 * Recent Writes. The Activity tab is the Activity pop-out kind's docked spot (activity-popout.tsx). The scene page renders this in place of the bare wing. The filing rows of Settings are the Settings tab's to host.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { recentWritesOf } from "./activity-core";
import { CompendiumWing, type CompendiumWingProps } from "./compendium-wing";
import { ExportButton } from "./export-button";
import { LockNotice } from "./standardize/standardize-cards";
import { StandardizeBanner } from "./standardize/standardize-banner";
import { useStandardize } from "./standardize/use-standardize";
import { ReconcileButton } from "./reconcile-modal";
import { PopoutSlot } from "../popout/popout-host";
import { activityPopout } from "./activity-popout";
import { useCompendiumReceipts } from "./use-compendium-receipts";

export function CompendiumWithFiling({ ctx, chat, books, settings, chip, onChat = () => undefined }: { ctx: AppContext; chat: Chat; books: readonly SceneLoreBook[] | null; /** Hands a scene the banner's saved settings changed back to the page. */ onChat?(chat: Chat): void } & Pick<CompendiumWingProps, "settings" | "chip">): JSX.Element {
  const std = useStandardize(ctx, chat.id);
  const feed = useCompendiumReceipts(ctx, chat.id, (books ?? []).filter((b) => !b.missing).map((b) => b.id));
  return (
    <CompendiumWing
      ctx={ctx} chat={chat} books={books} {...(settings ? { settings } : {})} {...(chip ? { chip } : {})} onChat={onChat}
      activity={() => <PopoutSlot kind={activityPopout} ctx={ctx} chat={chat} />}
      headerActions={(m) => <><ExportButton ctx={ctx} bookId={m.bookId} bookName={m.bookName} />{books ? <ReconcileButton ctx={ctx} chat={chat} books={books} locked={std.locked()} /> : null}</>}
      notice={(m) => (std.locked(m.bookId) ? <LockNotice /> : null)}
      banner={(m) => <StandardizeBanner ctx={ctx} chat={chat} onChat={onChat} bookId={m.bookId} model={m.model} std={std} />}
      recentWrites={recentWritesOf(feed.receipts, feed.facts, Date.now())}
    />
  );
}
