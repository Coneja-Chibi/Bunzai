/** Inventory's card line: items carried and currency. */
import { MAX_SLOTS, liveItems, readInventory } from "../../../../../../core/trackers/inventory";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const inv = readInventory(data);
  const items = liveItems(inv).length;
  const parts = [items > 0 ? `${count(items, "item")} of ${MAX_SLOTS} slots` : "", inv.currency > 0 ? `${inv.currency} currency` : ""].filter(Boolean);
  return parts.join(" · ");
}
