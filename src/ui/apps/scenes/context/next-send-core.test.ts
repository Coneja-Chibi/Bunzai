/** Next send's pure rules (rc-parity 08): RoleCall's copy format, its role-or-content search, and the match highlight. */
import { describe, expect, test } from "bun:test";
import { copyFormat, filterMessages, highlightParts, statusLine } from "./next-send-core";

const messages = [
  { role: "system", content: "Be Vera.", tokens: 4 },
  { role: "user", content: "Any storms?", tokens: 5 },
] as const;

describe("copyFormat", () => {
  test("is RoleCall's: [ROLE], the text, a blank line, blocks joined by a rule", () => {
    expect(copyFormat(messages)).toBe("[SYSTEM]\nBe Vera.\n\n---\n\n[USER]\nAny storms?\n");
  });
});

describe("filterMessages", () => {
  test("matches the role or the content, case blind; empty keeps all", () => {
    expect(filterMessages(messages, "")).toHaveLength(2);
    expect(filterMessages(messages, " STORM ").map((m) => m.role)).toEqual(["user"]);
    expect(filterMessages(messages, "system").map((m) => m.role)).toEqual(["system"]);
    expect(filterMessages(messages, "zzz")).toEqual([]);
  });
});

describe("highlightParts", () => {
  test("cuts the text into plain and matched parts, treating the query as text, not a pattern", () => {
    expect(highlightParts("a.c abc A.C", "a.c")).toEqual([{ text: "a.c", hit: true }, { text: " abc ", hit: false }, { text: "A.C", hit: true }]);
    expect(highlightParts("plain", "")).toEqual([{ text: "plain", hit: false }]);
  });
});

describe("statusLine", () => {
  test("is RoleCall's three lines", () => {
    expect(statusLine({ count: 2, tokens: 9 }, false)).toBe("2 messages | ~9 tokens");
    expect(statusLine(null, true)).toBe("Generating preview...");
    expect(statusLine(null, false)).toBe("Type a message to see preview");
  });
});
