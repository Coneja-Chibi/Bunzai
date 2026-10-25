/**
 * The Claude Agent SDK is an optional, proprietary dependency: when it cannot be imported, every
 * path that needs it must say how to install it instead of showing a stack trace.
 *
 * The import is mocked for the whole process (Bun has no unmock, and restoring would mean loading the
 * real SDK first, which defeats the mock), so this file stays alone. The opt-in live test runs as its
 * own invocation and is unaffected.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { makeClaudeCliChat, runClaudeCli, SDK_MISSING_MESSAGE } from "./claude-cli";
import claudeSub from "./spokes/claude-sub";

const SDK = "@anthropic-ai/claude-agent-sdk";
// Re-armed per test: Bun serves an empty module after the first failed import of a mocked specifier.
beforeEach(() => { mock.module(SDK, () => { throw new Error(`Cannot find package '${SDK}'`); }); });

describe("the Claude Agent SDK is missing", () => {
  test("a turn reports the install instruction instead of a stack trace", async () => {
    const out = await runClaudeCli("sonnet", "SYS", [{ role: "user", content: "hi" }]);
    expect(out).toEqual({ ok: false, reason: "not-installed", detail: SDK_MISSING_MESSAGE });
    expect(SDK_MISSING_MESSAGE).toContain("Claude subscription features need the optional Claude Agent SDK; install it with");
  });

  test("the chat function Kit calls throws that same message", async () => {
    const chat = makeClaudeCliChat("sonnet", "SYS");
    await expect(chat([{ role: "user", content: "hi" }], [])).rejects.toThrow(SDK_MISSING_MESSAGE);
  });

  test("the model picker degrades to no suggestions rather than throwing", async () => {
    // the spoke reads neither argument: it asks the CLI
    expect(await claudeSub.listModels!(undefined as never, undefined as never)).toEqual([]);
  });
});
