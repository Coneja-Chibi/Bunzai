/**
 * {{message history}} and {{memories}} render exactly as RoleCall's do at the pin, including two
 * RoleCall bugs kept for parity until the owner rules on them (* findings): the newest entry comes first, and a truncated message repeats its speaker prefix.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";

const ctx = createDefaultContext({
  characterName: "Aria",
  userName: "Chi",
  messages: [
    { role: "user", content: "first msg" },
    { role: "assistant", content: "second msg" },
    { role: "user", content: "third msg" },
  ],
  messageCount: 3,
  chatMemories: ["mem A (oldest)", "mem B", "mem C (newest)"],
});

describe("history macros (RoleCall order)", () => {
  test("{{message history}} lists the newest message first", () => {
    expect(processMacros("{{message history}}", ctx).text).toBe(
      "=== MESSAGE HISTORY ===\nChi: third msg\nAria: second msg\nChi: first msg\n======================\n",
    );
  });

  test("{{memories}} lists the newest memory first", () => {
    expect(processMacros("{{memories}}", ctx).text).toContain("- mem C (newest)\n- mem B\n- mem A (oldest)");
  });

  test("a truncated message carries its speaker prefix twice", () => {
    const long = createDefaultContext({ characterName: "Aria", messages: [{ role: "assistant", content: "D".repeat(400) }], messageCount: 1 });
    expect(processMacros("{{message history::40}}", long).text).toContain("Aria: Aria: DDD");
  });
});
