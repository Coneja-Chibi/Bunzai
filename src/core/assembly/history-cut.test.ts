/**
 * `minHistoryKeep`: the floor a safe history pre-trim must respect so a depth
 * note, an in-chat block or a role-specific append block still finds the same history
 * `buildConversation`/`injectAtDepth`/`appendAtDepth` (conversation.ts) would have given it.
 */
import { describe, expect, test } from "bun:test";
import { minHistoryKeep, type DepthPlacement } from "./history-cut";
import type { AssembledRole } from "./types";

const roles = (spec: string): AssembledRole[] =>
  [...spec].map((c) => (c === "u" ? "user" : c === "a" ? "assistant" : "system"));

describe("minHistoryKeep", () => {
  test("nothing placed by depth: no floor at all", () => {
    expect(minHistoryKeep(roles("uauauaua"), [])).toBe(0);
  });

  test("a generic depth note needs that many conversational messages from the tail", () => {
    const placements: DepthPlacement[] = [{ depth: 2 }];
    // depth 2 needs 3 conversational matches from the end; here every message counts.
    expect(minHistoryKeep(roles("uauauaua"), placements)).toBe(3);
  });

  test("system-role history messages never count toward a generic (role-agnostic) depth", () => {
    const placements: DepthPlacement[] = [{ depth: 1 }];
    // "uassa": from the end, "a"(1st match) then two skipped "s"s then "a"(2nd match) at index 1,
    // 4 messages from the tail.
    expect(minHistoryKeep(roles("uassa"), placements)).toBe(4);
  });

  test("an append item's role narrows the count: an all-user tail needs far more history for an assistant target", () => {
    const allUser = roles("uuuuuuuu");
    expect(minHistoryKeep(allUser, [{ depth: 0, role: "user" }])).toBe(1);
    // No assistant messages exist at all: keeps everything, matching appendAtDepth's own
    // "insert a new message" fallback, which behaves the same whether or not more history exists.
    expect(minHistoryKeep(allUser, [{ depth: 0, role: "assistant" }])).toBe(allUser.length);
  });

  test("fewer matches than depth+1 exist anywhere: keeps the whole history, not a partial guess", () => {
    const placements: DepthPlacement[] = [{ depth: 10 }];
    expect(minHistoryKeep(roles("uaua"), placements)).toBe(4);
  });

  test("the largest requirement across every placement wins", () => {
    const placements: DepthPlacement[] = [{ depth: 0 }, { depth: 3, role: "assistant" }, { depth: 1, role: "user" }];
    // depth 3 assistant: the 4th assistant from the end, over an alternating 12-message tail.
    expect(minHistoryKeep(roles("uauauauauaua"), placements)).toBe(minHistoryKeep(roles("uauauauauaua"), [{ depth: 3, role: "assistant" }]));
  });

  test("an empty history keeps nothing (there is nothing to keep)", () => {
    expect(minHistoryKeep([], [{ depth: 5 }])).toBe(0);
  });
});
