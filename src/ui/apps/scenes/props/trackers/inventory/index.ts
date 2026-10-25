/**
 * Inventory, RoleCall's `inventory` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): items, equipment, and loot. Registered in
 * props/registry.ts; the state is ChatStore rule 43's `inventory`, the rules are core/trackers/inventory.ts.
 */
import { trackerProp } from "../tracker-prop";
import { InventoryPanel } from "./inventory-panel";

export const inventoryProp = trackerProp({
  module: "inventory",
  name: "Inventory",
  blurb: "Items, equipment, currency, and carried objects.",
  icon: "lucide:backpack",
  tone: "var(--stage-macro)",
  group: "legacy",
  reach: "model",
  title: "Inventory",
  noun: "Inventory",
  Panel: InventoryPanel,
});
