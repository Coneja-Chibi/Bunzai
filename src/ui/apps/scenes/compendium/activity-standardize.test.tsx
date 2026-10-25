/**
 * Standardize and Revert in the Activity feed: a Standardize run's receipts are "Standardized" cards (what was typed, merged, made
 * and retired, in RoleCall's Standardize words), the undo of one is a "Reverted" card, neither is worded as a filing, and a
 * standardize receipt offers no per-card Undo (Revert is the way back). Core rows and the drawn card.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { CompendiumReceipt } from "../../../../stage/contracts/chat-store";
import { teardownAllDoms } from "../../../_shared/test-dom";
import { installLoreDom, qa, rig, settle, text, type FlushSync } from "../fake-lore-rig";
import { ActivityCard } from "./activity-card";
import { feedRows, toRow } from "./activity-core";

const base = { chatId: "c", branchId: "b", at: 1_000, settledAt: 1_000 };
const w = (op: "create" | "update" | "retire", entryId: string, after: Record<string, unknown>) => ({ bookId: "bk", entryId, op, fields: { before: {}, after } }) as CompendiumReceipt["writes"][number];
const std: CompendiumReceipt = {
  ...base, id: "s1", kind: "standardize", status: "filed", model: "vera-1",
  writes: [w("update", "a", { type: "character", "data.name": "Aria" }), w("update", "b", { type: "location", "data.name": "Dock" }), w("update", "t", { "data.memories": ["m"] }), w("create", "n", { "data.name": "Gale" }), w("retire", "c", { enabled: false })],
};
const reverted: CompendiumReceipt = { ...base, id: "u1", at: 2_000, kind: "undo", status: "filed", undoes: "s1", writes: [w("update", "a", {}), w("update", "b", {}), w("retire", "n", {})] };
const facts = new Map([["a", { name: "Aria", type: "character" as const }]]);

describe("the rows", () => {
  test("a Standardize receipt is Standardized, with what it typed, merged, made and consumed, and no Undo", () => {
    const row = toRow(std, facts, new Map([["s1", "standardize"]]));
    expect(row).toMatchObject({ label: "Standardized", card: "standardize", text: "Standardized 2 entries (1 merged, 1 new, 1 consumed)", canUndo: false, canFileAgain: false, tab: "entries" });
    expect(row.lines.map((l) => [l.name, l.verb])).toEqual([["Aria", "typed"], ["Dock", "typed"], ["t", "merged"], ["Gale", "created"], ["c", "retired"]]);
  });

  test("the undo of one is Reverted, in RoleCall's Revert words, and the undo of a filing is still Undone", () => {
    const kinds = new Map([["s1", "standardize"], ["f1", "filing"]] as const);
    expect(toRow(reverted, facts, kinds)).toMatchObject({ label: "Reverted", card: "revert", text: "Reverted 3 entries" });
    expect(toRow({ ...reverted, status: "partly_filed" }, facts, kinds).text).toBe("Reverted 3, some left as they are");
    expect(toRow({ ...reverted, undoes: "f1" }, facts, kinds)).toMatchObject({ label: "Undone", text: "Restored 3 entries" });
  });

  test("its other states are worded as a run, not a filing", () => {
    const row = (status: CompendiumReceipt["status"], extra: Partial<CompendiumReceipt> = {}) => toRow({ ...std, status, writes: [], ...extra }, facts).text;
    expect(row("running")).toBe("Standardizing");
    expect(row("nothing_to_file", { reason: "0 converted" })).toBe("Nothing converted");
    expect(row("undone", { writes: std.writes })).toBe("Standardized 2 entries (1 merged, 1 new, 1 consumed), then reverted");
    expect(row("failed", { reason: "the book is gone" })).toBe("Failed: the book is gone");
  });

  test("the feed pairs an undo with the receipt it reverses", () => {
    const rows = feedRows([reverted, std], 0, "all", facts);
    expect(rows.map((r) => r.label)).toEqual(["Reverted", "Standardized"]);
  });
});

describe("the card", () => {
  let flushSync: FlushSync;
  beforeAll(async () => { installLoreDom(); flushSync = (await import("react-dom")).flushSync; });
  afterAll(async () => { await teardownAllDoms(); });

  test("draws its own card type: a layers icon and a data-card of standardize, a redo icon and revert, with the words above", async () => {
    const { createRoot } = await import("react-dom/client");
    rig.host = rig.dom.window.document.createElement("div");
    rig.dom.window.document.body.appendChild(rig.host);
    rig.root = createRoot(rig.host);
    const actions = { undo: () => undefined, again: () => undefined, busy: false };
    flushSync(() => rig.root.render(createElement("div", null,
      createElement(ActivityCard, { row: toRow(std, facts), now: 5_000, actions }),
      createElement(ActivityCard, { row: toRow(reverted, facts, new Map([["s1", "standardize"]])), now: 5_000, actions }))));
    await settle(flushSync);
    expect(qa(".cp-act").map((c) => c.getAttribute("data-card"))).toEqual(["standardize", "revert"]);
    expect(qa(".cp-act .lab").map((l) => l.textContent)).toEqual(["Standardized", "Reverted"]);
    expect(text()).toContain("Standardized 2 entries (1 merged, 1 new, 1 consumed)");
    expect(text()).not.toMatch(/Filed|Undo\b/);
    flushSync(() => rig.root.unmount());
  });
});
