/**
 * What a chat shows, RoleCall's way (ADR-012 amendment, 2026-09-26): every message, the greeting
 * included, runs through the full macro engine each time it is shown, against the chat's frozen cast.
 * Variables are a working copy for this one showing, shared in order across its messages and then
 * dropped; the seed and the clock are the caller's, never ambient, and each text takes the next seed. The stored text is never changed.
 *
 * Also strips inline <think>/<thinking>/<thought> blocks (stripReasoningTags), the shape SillyTavern
 * imports carry inline in a message's own text when ST's native reasoning auto-parse or a markdownOnly
 * regex script would have hidden them there. Display-only, same as the macro pass: never rewrites the
 * stored message.
 */
import { createDefaultContext, processMacros, type ChatMessage, type MacroContext, type MacroVariable } from "./macros";
import type { CharacterCardContext } from "./macros/handlers/character";
import { bodyOf, isRecord, str } from "./guards";
import { stripReasoningTags, type ReasoningFormat } from "./reasoning-tags";

export interface DisplayInput {
  /** The chat's frozen character (CastSnapshot.character): a canonical character entity. */
  character: unknown;
  /** The chat's frozen persona, if it has one. */
  persona?: unknown;
  messages: readonly ChatMessage[];
  messageCount?: number;
  messageIndices?: number[];
  messageLookup?: ReadonlyMap<number, ChatMessage>;
  missingMessageIndices?: Set<number>;
  userMessageCount?: number;
  assistantMessageCount?: number;
  lastUserMessageIndex?: number;
  lastAssistantMessageIndex?: number;
  variables?: ReadonlyMap<string, MacroVariable>;
  /** The scene preset's reasoning markers; absent means the built-in think tags. */
  reasoning?: ReasoningFormat;
  randomSeed: number;
  now: number;
}

const field = (body: Record<string, unknown>, group: string, key: string): string => str(isRecord(body[group]) ? body[group][key] : undefined);

/** A renderer for one showing: call it on each text in display order. */
export function chatDisplay(input: DisplayInput): (text: string, semanticOrdinal?: number) => string {
  const character = bodyOf(input.character);
  const examples = field(character, "examples", "exampleMessages");
  // Exactly the card fields RoleCall's display sets (prompt-builder.ts buildMacroContext, with its
  // VVS-557 fix), in its shapes: the examples split into lines, so {{mesExamples}} joins them with a
  // blank line. {{firstMessage}}, {{charCreator}} and {{charTags}} render empty in a RoleCall bubble,
  // so they do here too (listed as candidate deviations).
  const card: Partial<CharacterCardContext> = {
    mesExamples: examples ? examples.split("\n").filter(Boolean) : undefined,
    charPrompt: field(character, "prompts", "systemPrompt"),
    charInstruction: field(character, "prompts", "postHistoryInstructions"),
    charCreatorNotes: field(character, "attribution", "creatorNotes"),
  };
  const persona = bodyOf(input.persona);
  const context = createDefaultContext({
    ...card,
    characterName: field(character, "identity", "name"),
    userName: str(persona["name"]) || "User",
    userPersona: str(persona["content"]),
    characterDescription: field(character, "identity", "description"),
    characterPersonality: field(character, "persona", "personality"),
    scenario: field(character, "persona", "scenario"),
    messages: [...input.messages],
    messageCount: input.messageCount ?? input.messages.length,
    ...(input.messageIndices === undefined ? {} : { messageIndices: input.messageIndices }),
    ...(input.messageLookup === undefined ? {} : { messageLookup: input.messageLookup }),
    ...(input.missingMessageIndices === undefined ? {} : { missingMessageIndices: input.missingMessageIndices }),
    ...(input.userMessageCount === undefined ? {} : { userMessageCount: input.userMessageCount }),
    ...(input.assistantMessageCount === undefined ? {} : { assistantMessageCount: input.assistantMessageCount }),
    ...(input.lastUserMessageIndex === undefined ? {} : { lastUserMessageIndex: input.lastUserMessageIndex }),
    ...(input.lastAssistantMessageIndex === undefined ? {} : { lastAssistantMessageIndex: input.lastAssistantMessageIndex }),
    localVariables: new Map(input.variables),
    randomSeed: input.randomSeed,
    now: input.now,
  });
  // The engine reseeds each call; full-context callers advance the seed, while paged callers pass a
  // stable live-message ordinal so hydrating an older page cannot change an existing bubble's roll.
  let n = 0;
  // RoleCall builds a fresh context per displayed text, so no macro, template, override or counter
  // defined in one bubble reaches the next. Only variables carry across, as they do there.
  const fresh = (): Partial<MacroContext> => ({ userMacros: new Map(), templates: new Map(), blockOverrides: new Map(), counters: new Map() });
  return (text, semanticOrdinal?: number) => {
    const stripped = stripReasoningTags(text, input.reasoning);
    if (!stripped.includes("{{")) return stripped;
    const randomSeed = semanticOrdinal === undefined ? input.randomSeed + n++ : input.randomSeed + semanticOrdinal;
    return processMacros(stripped, { ...context, ...fresh(), randomSeed }).text;
  };
}
