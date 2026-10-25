/** The message-count window (RoleCall's applyMessageContextWindow): N prior messages, the greeting always kept. */
import { describe, expect, test } from "bun:test";
import { DEFAULT_MAX_MESSAGES, estimateMessageWindow, windowPrior } from "./message-window";

const m = (role: "user" | "assistant", content: string) => ({ role, content });
const prior = [m("assistant", "hello"), m("user", "a"), m("assistant", "b"), m("user", "c"), m("assistant", "d")];

describe("windowPrior", () => {
  test("tokens mode, or no mode, keeps every message", () => {
    expect(windowPrior(prior, undefined)).toEqual(prior);
    expect(windowPrior(prior, { contextMode: "tokens", maxMessages: 1 })).toEqual(prior);
    expect(windowPrior(prior, { maxMessages: 1 })).toEqual(prior);
  });

  test("messages mode keeps exactly the newest N prior messages; the greeting stays in front", () => {
    expect(windowPrior(prior, { contextMode: "messages", maxMessages: 2 }).map((x) => x.content)).toEqual(["hello", "c", "d"]);
    expect(windowPrior(prior, { contextMode: "messages", maxMessages: 0 }).map((x) => x.content)).toEqual(["hello"]);
    expect(windowPrior(prior, { contextMode: "messages", maxMessages: 99 })).toEqual(prior);
  });

  test("a window that already reaches the greeting does not repeat it", () => {
    expect(windowPrior(prior, { contextMode: "messages", maxMessages: 5 })).toEqual(prior);
  });

  test("a scene that opens on a user message has no greeting to keep", () => {
    expect(windowPrior(prior.slice(1), { contextMode: "messages", maxMessages: 1 }).map((x) => x.content)).toEqual(["d"]);
  });

  test("messages mode with no count uses the default shown in the Booth", () => {
    const long = Array.from({ length: DEFAULT_MAX_MESSAGES + 10 }, (_, i) => m(i % 2 ? "user" : "assistant", String(i)));
    expect(windowPrior(long, { contextMode: "messages" })).toHaveLength(DEFAULT_MAX_MESSAGES + 1);
  });
});

describe("estimateMessageWindow", () => {
  const count = (s: string) => s.length;
  test("a chat ending on the person's message counts that message beside the N before it", () => {
    const chat = [...prior, m("user", "now")];
    expect(estimateMessageWindow(chat, { contextMode: "messages", maxMessages: 2 }, count)).toEqual({ tokens: 5 + 1 + 1 + 3, kept: 4, total: 6 });
  });
  test("an empty chat is none", () => {
    expect(estimateMessageWindow([], { contextMode: "messages", maxMessages: 2 }, count)).toEqual({ tokens: 0, kept: 0, total: 0 });
  });
});
