/** The summary model's prompts (RoleCall `summary-backfill.ts`, rc-parity 08): RoleCall's wording, the variables a person's own template may use, and the checks on a backfill's answer. */
import { describe, expect, test } from "bun:test";
import { PAIR_PROMPT, backfillPrompt, checkPairBackfill, combinePrompt, exchangesOf, nextTurn, pairPrompt, renderTemplate, rollingPrompt, tidyLine } from "./prompts";

describe("rollingPrompt", () => {
  test("a first summary has no existing text to refresh; later ones refresh or extend it", () => {
    expect(rollingPrompt("replace", false)).toContain("Summarize this chat between the user and {{characterName}} in 2-3 sentences.");
    expect(rollingPrompt("additive", false)).toBe(rollingPrompt("replace", false));
    expect(rollingPrompt("replace", true)).toContain("COMPLETE REPLACEMENT SUMMARY:");
    expect(rollingPrompt("additive", true)).toContain("Respond with the COMPLETE updated summary (existing + new).");
  });
});

describe("renderTemplate", () => {
  test("fills the name, the history (as {{conversationHistory}} or {{messages}}) and the existing summary", () => {
    const out = renderTemplate({ template: "{{characterName}} / {{existingSummary}} / {{messages}}", characterName: "Vera", conversationHistory: "[user]: Hi", existingSummary: "Old." });
    expect(out).toBe("Vera / Old. / [user]: Hi");
  });
  test("a template with no history variable gets the history appended, so the model is never asked about nothing", () => {
    expect(renderTemplate({ template: "Recap it.", characterName: "Vera", conversationHistory: "[user]: Hi" })).toBe("Recap it.\n\nConversation history:\n[user]: Hi\n\nSummary:");
  });
  test("a name or a message holding $ patterns is inserted as typed", () => {
    expect(renderTemplate({ template: "{{characterName}}: {{conversationHistory}}", characterName: "$&Vera", conversationHistory: "costs $1 and $$" })).toBe("$&Vera: costs $1 and $$");
  });
});

describe("pairPrompt", () => {
  test("adds the two messages and the one-sentence demand, unless the template already names them", () => {
    const plain = pairPrompt({ template: PAIR_PROMPT, characterName: "Vera", userMessage: "Hi", assistantMessage: "Hello." });
    expect(plain).toContain("User message:\nHi");
    expect(plain).toContain("Vera response:\nHello.");
    expect(plain.endsWith("Return exactly one concise summary sentence with no preamble, quotes, or turn number.")).toBe(true);
    const named = pairPrompt({ template: "U={{userMessage}} A={{aiMessage}}", characterName: "Vera", userMessage: "Hi", assistantMessage: "Hello." });
    expect(named).toBe("U=Hi A=Hello.\n\nReturn exactly one concise summary sentence with no preamble, quotes, or turn number.");
  });
});

describe("tidyLine and nextTurn", () => {
  test("a line loses its quotes and extra whitespace", () => expect(tidyLine('  "They  met\nat the pier."  ')).toBe("They met at the pier."));
  test("the next turn is one past the highest Turn N already there", () => {
    expect(nextTurn("")).toBe(1);
    expect(nextTurn("Turn 1: a\nTurn 2: b\nTurn 7: c")).toBe(8);
    expect(nextTurn("A rolling summary with Turn 4: not at a line start")).toBe(1);
  });
});

describe("exchangesOf", () => {
  test("pairs each reply with the user messages before it; a trailing user message with no reply is left out", () => {
    const m = (role: string, content: string) => ({ role, content });
    const out = exchangesOf([m("user", "a"), m("user", "b"), m("assistant", "c"), m("assistant", "stray"), m("user", "d"), m("assistant", "e"), m("user", "f")]);
    expect(out.map((e) => e.map((x) => x.content))).toEqual([["a", "b", "c"], ["d", "e"]]);
  });
});

describe("backfillPrompt", () => {
  const base = { characterName: "Vera", conversationHistory: "[user]: Hi\n[assistant]: Hello." };
  test("the rolling modes use the person's template when there is one, else RoleCall's", () => {
    expect(backfillPrompt({ ...base, mode: "replace" })).toContain("Summarize the entire roleplay chat between the user and Vera.");
    expect(backfillPrompt({ ...base, mode: "additive" })).toContain("Backfill a chronological, cumulative summary of this entire roleplay chat between the user and Vera.");
    expect(backfillPrompt({ ...base, mode: "replace", customPrompt: "Mine: {{messages}}" })).toBe("Mine: [user]: Hi\n[assistant]: Hello.");
  });
  test("every exchange owns the numbered format, naming the turns; the person's template is only added as guidance, its pair variables worded for a batch", () => {
    const out = backfillPrompt({ ...base, mode: "pair", startTurn: 3, pairCount: 2, customPrompt: "Mention {{userMessage}} and {{aiMessage}}." });
    expect(out).toContain("Number the lines consecutively from Turn 3 through Turn 4.");
    expect(out).toContain("Turn 3: ...\nTurn 4: ...");
    expect(out).toContain("Additional user-authored summary instructions:\nMention the user message in each exchange and the assistant response in each exchange.");
  });
});

describe("combinePrompt and checkPairBackfill", () => {
  test("two halves become one", () => {
    expect(combinePrompt("A.", "B.")).toContain("EARLIER PART:\nA.\n\nLATER PART:\nB.\n\nCOMPLETE SUMMARY:");
  });
  test("a per-exchange backfill is accepted only with every turn, in order, from the start", () => {
    expect(checkPairBackfill("Turn 1: a\nTurn 2: b", 2)).toBeNull();
    expect(checkPairBackfill("Turn 3: a\nTurn 4: b", 2, 3)).toBeNull();
    expect(checkPairBackfill("Turn 1: a", 2)).toBe("Per-exchange backfill returned 1 of 2 turns; the existing summary was left unchanged.");
    expect(checkPairBackfill("Turn 2: a\nTurn 1: b", 2)).toBe("Per-exchange backfill turns were not numbered in order; the existing summary was left unchanged.");
  });
});
