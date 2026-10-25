/** The Memory tab's pure rules (rc-parity 08; RoleCall `MemoryPanel.tsx`): its words for the current settings, and the patches its controls make (a switch from interval 0 gives it 60, and so on). */
import { describe, expect, test } from "bun:test";
import { resolveSummary } from "../../../../core/summary/settings";
import {
  autoPatch, backfillLabel, compactModelName, contextLabel, controlsLine, heroSubtitle, hidePatch, intervalPatch, methodLabel, methodPatch, optionOf, promptVariables, timingLabel,
} from "./memory-core";

const r = (saved = {}) => resolveSummary(saved);

describe("the labels", () => {
  test("method: Every exchange, Timeline, Rolling recap", () => {
    expect(optionOf(r({ method: "pair" }))).toBe("pair");
    expect(optionOf(r({ mode: "additive" }))).toBe("additive");
    expect(optionOf(r())).toBe("replace");
    expect([methodLabel("pair"), methodLabel("additive"), methodLabel("replace")]).toEqual(["Every exchange", "Timeline", "Rolling recap"]);
    expect([backfillLabel("pair"), backfillLabel("additive"), backfillLabel("replace")]).toEqual(["Per-exchange", "Rolling Additive", "Rolling Replace"]);
  });
  test("runs: Manual only until it is on and has something to count by", () => {
    expect(timingLabel(r())).toBe("Manual only");
    expect(timingLabel(r({ auto: true }))).toBe("Manual only");
    expect(timingLabel(r({ auto: true, interval: 30 }))).toBe("Every 30 messages");
    expect(timingLabel(r({ auto: true, method: "pair" }))).toBe("Every exchange");
  });
  test("AI context: Off, the newest N kept, or the summary beside the chat", () => {
    expect(contextLabel(r({ include: false }))).toBe("Off");
    expect(contextLabel(r({ hideOld: true, keepRecent: 40 }))).toBe("40 kept");
    expect(contextLabel(r({ hideOld: true }))).toBe("Summary + chat");
    expect(contextLabel(r())).toBe("Summary + chat");
  });
  test("a long model name is cut to 24 characters, and a path keeps its last part", () => {
    expect(compactModelName("anthropic/claude-sonnet-4")).toBe("claude-sonnet-4");
    expect(compactModelName("a-very-long-model-name-indeed-yes")).toBe("a-very-long-model-nam...");
  });
  test("the prompt's variables differ for Every exchange", () => {
    expect(promptVariables("pair")).toEqual(["{{characterName}}", "{{userMessage}}", "{{aiMessage}}"]);
    expect(promptVariables("replace")).toEqual(["{{characterName}}", "{{conversationHistory}}"]);
  });
});

describe("the sentences", () => {
  test("the controls line says what is running, in RoleCall's words", () => {
    expect(controlsLine(r())).toBe("Automatic summaries are off. Turn them on to summarize every 60 messages; manual edits and Backfill history still work.");
    expect(controlsLine(r({ auto: true, interval: 30 }))).toBe("The summary updates after every 30 persisted messages.");
    expect(controlsLine(r({ auto: true, method: "pair" }))).toBe("One compact line is added after every user and AI exchange.");
  });
  test("the hero subtitle follows the state and names the character", () => {
    expect(heroSubtitle(r(), "Vera")).toBe("Automatic summary generation is not currently running. You can still write or backfill the summary manually.");
    expect(heroSubtitle(r({ auto: true, interval: 30 }), "Vera")).toBe("Auto-generated summary of your story with Vera. Runs at your exact configured interval and powers chat-card previews + AI context.");
    expect(heroSubtitle(r({ auto: true, method: "pair" }), "Vera")).toBe("Auto-generated turn-by-turn summary of your story with Vera. Powers chat-card previews + AI context.");
  });
});

describe("the patches", () => {
  test("switching automation on from interval 0 gives it a cadence of 60, so it never shows On while the runtime cannot run; Every exchange needs none; off only turns it off", () => {
    expect(autoPatch(r(), true)).toEqual({ auto: true, interval: 60 });
    expect(autoPatch(r({ interval: 20 }), true)).toEqual({ auto: true });
    expect(autoPatch(r({ method: "pair" }), true)).toEqual({ auto: true });
    expect(autoPatch(r({ auto: true, interval: 20 }), false)).toEqual({ auto: false });
  });
  test("Summarize every: zero or nothing turns automation off, a number turns it on", () => {
    expect(intervalPatch(0)).toEqual({ interval: 0, auto: false });
    expect(intervalPatch(Number.NaN)).toEqual({ interval: 0, auto: false });
    expect(intervalPatch(45)).toEqual({ interval: 45, auto: true });
  });
  test("choosing a method: Every exchange, or a rolling mode, which also gives a switched-on rolling summary its 60 when it had no interval", () => {
    expect(methodPatch(r(), "pair")).toEqual({ method: "pair" });
    expect(methodPatch(r(), "additive")).toEqual({ method: "rolling", mode: "additive" });
    expect(methodPatch(r({ auto: true, method: "pair" }), "replace")).toEqual({ interval: 60, method: "rolling", mode: "replace" });
    expect(methodPatch(r({ auto: true, interval: 20, method: "pair" }), "replace")).toEqual({ method: "rolling", mode: "replace" });
  });
  test("Hide covered messages: turning it on with no Keep recent chosen takes the window it would use, else 60", () => {
    expect(hidePatch(r({ window: 12 }))).toEqual({ hideOld: true, keepRecent: 12 });
    expect(hidePatch(r())).toEqual({ hideOld: true, keepRecent: 60 });
    expect(hidePatch(r({ keepRecent: 30 }))).toEqual({ hideOld: true });
    expect(hidePatch(r({ hideOld: true, keepRecent: 30 }))).toEqual({ hideOld: false });
  });
});
