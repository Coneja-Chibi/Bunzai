/** chatDisplay (ADR-012 amendment): RoleCall's display-time macro pass over a chat's frozen cast. */
import { expect, test } from "bun:test";
import { chatDisplay } from "./chat-display";
import type { MacroVariable } from "./macros";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "a bard" }, persona: { scenario: "a tavern" } } };
const chi = { kind: "persona", id: "chi", body: { name: "Chi", content: "" } };
const base = { character: vera, persona: chi, messages: [], randomSeed: 7, now: 0 };

test("names and card fields resolve from the frozen cast; text without macros passes through", () => {
  const show = chatDisplay(base);
  expect(show("Hello {{user}}, I am {{char}}, {{description}}, in {{scenario}}.")).toBe("Hello Chi, I am Vera, a bard, in a tavern.");
  expect(show("plain words")).toBe("plain words");
  expect(chatDisplay({ ...base, persona: undefined })("{{user}}")).toBe("User");
});

test("a roll is the caller's seed: the same seed replays, other seeds and later bubbles roll again", () => {
  const roll = "{{random::a::b::c::d::e::f::g::h}}";
  const firstFive = (seed: number): string[] => { const show = chatDisplay({ ...base, randomSeed: seed }); return [1, 2, 3, 4, 5].map(() => show(roll)); };
  expect(firstFive(7)).toEqual(firstFive(7));
  expect(new Set(firstFive(7)).size).toBeGreaterThan(1);
  expect(firstFive(7)).not.toEqual(firstFive(1_000_003));
});

test("a setvar reaches later messages in the same showing, and never the caller's variables", () => {
  const variables = new Map<string, MacroVariable>([["mood", { value: "calm", createdAt: 0, updatedAt: 0 }]]);
  const show = chatDisplay({ ...base, variables });
  expect(show("{{setvar::mood::stormy}}")).toBe("");
  expect(show("{{getvar::mood}}")).toBe("stormy");
  expect(variables.get("mood")?.value).toBe("calm");
  expect(chatDisplay({ ...base, variables })("{{getvar::mood}}")).toBe("calm");
});

test("{{rcounter}} counts from one in every message, as RoleCall's display does", () => {
  const show = chatDisplay(base);
  expect(show("{{rcounter::step}} {{rcounter::step}}")).toBe("1 2");
  expect(show("{{rcounter::step}}")).toBe("1");
});

test("the card's prompt fields reach the bubble, not just the prompt (RoleCall's VVS-557)", () => {
  const card = {
    body: {
      identity: { name: "Vera" },
      persona: {},
      prompts: { systemPrompt: "SYSTEM PROMPT TEXT", postHistoryInstructions: "POST HISTORY TEXT" },
      greetings: { firstMessage: "Hi there." },
      examples: { exampleMessages: "<START>\nVera: hm." },
      attribution: { creatorNotes: "CREATOR NOTES TEXT", creator: "Chi" },
      discovery: { tags: ["bard", "fantasy"] },
    },
  };
  const show = chatDisplay({ ...base, character: card });
  expect(show("{{charPrompt}}|{{charInstruction}}|{{charCreatorNotes}}")).toBe("SYSTEM PROMPT TEXT|POST HISTORY TEXT|CREATOR NOTES TEXT");
  // RoleCall's display splits the examples into lines and never sets the creator or greeting fields.
  expect(show("{{mesExamples}}|{{charCreator}}|{{firstMessage}}")).toBe("<START>\n\nVera: hm.||");
  expect(show("[{{charPrompt}}]")).toBe("[SYSTEM PROMPT TEXT]");
  expect(chatDisplay(base)("[{{charPrompt}}]")).toBe("[]");
});

test("a macro or template defined in one bubble does not reach the next (RoleCall's fresh context)", () => {
  const show = chatDisplay(base);
  expect(show("{{macro::m::hi}}[{{macro::m}}]{{template::t::yo}}[{{use::t}}]")).toBe("[hi][yo]");
  expect(show("[{{macro::m}}]")).not.toBe("[hi]");
  expect(show("[{{use::t}}]")).not.toBe("[yo]");
});

test("the persona's text is {{persona}}", () => {
  const persona = { kind: "persona", id: "p", body: { name: "Chi", content: "a playwright" } };
  expect(chatDisplay({ ...base, persona })("{{persona}}")).toBe("a playwright");
});

// -- inline <think> blocks (VVS: imported SillyTavern chats leaked think/reasoning text into bubbles) --

test("an inline <think> block from an imported ST message never reaches the bubble", () => {
  const show = chatDisplay(base);
  expect(show("<think>\nplanning the scene\n</think>\n\nShe opened the door.")).toBe("She opened the door.");
});

test("a think block and a macro in the same message: both are handled, neither leaks", () => {
  const show = chatDisplay(base);
  expect(show("<think>should I greet {{user}}?</think>Hello {{user}}.")).toBe("Hello Chi.");
});

test("the scene preset's own reasoning markers hide the reasoning, and a macro in the reply still resolves", () => {
  const show = chatDisplay({ ...base, reasoning: { prefix: "<|channel>thought\n", suffix: "<channel|>", separator: "\n\n" } });
  expect(show("<|channel>thought\nshould I greet {{user}}?<channel|>\n\nHello {{user}}.")).toBe("Hello Chi.");
});
