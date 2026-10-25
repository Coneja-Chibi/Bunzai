/**
 * Chat-context macros: the running conversation (RoleCall's own file name for this family is
 * "scene", despite the content being message/chat access, not stage blocking). Ported from
 * RoleCall inside ADR-012: no behavior change, only
 * the registration mechanism, `console.log` debug lines dropped (dead in a data-only handler, no
 * host to log to), and the two deviations below.
 *
 * `chatStartTime`/`lastActivityTime` are epoch ms numbers on Bunraku's `MacroContext` (ADR-012: no
 * ambient clock, no `Date` objects riding the context), so `chatStartMacro` converts with
 * `new Date(context.chatStartTime)`, a pure wrap of a caller-supplied value, not the banned ambient
 * `new Date()`.
 *
 * Deviation: `{{message history}}`/`{{memories}}` token-budget accounting. RoleCall counts with
 * `gpt-tokenizer`'s real BPE encoder (lib/lorebook/tokenizer.ts); that dependency is not part of
 * this port (leaves the token counter choice open for step 2b) and a
 * macro handler may not reach outside `src/core/macros` for it. `estimateTokens` below uses
 * RoleCall's OWN fallback path (its tokenizer module falls back to `Math.ceil(text.length / 4)` if
 * `encode` throws), so the budget behaves the same shape, just less precisely, until 2b lands the
 * real counter and this can call it. Not exercised by the RoleCall parity corpus, which sets no
 * messages or memories on its recorded entries.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

/** RoleCall's own tokenizer fallback estimate (lib/lorebook/tokenizer.ts); see header deviation. */
const estimateTokens = (text: string): number => (text ? Math.ceil(text.length / 4) : 0);

/** Reads one absolute live-message ordinal from the visible page or the demanded-data map. */
function messageAt(context: MacroContext, index: number) {
  if (index < 0 || index >= context.messageCount) return undefined;
  const requested = context.messageLookup?.get(index);
  if (requested) return requested;
  const visible = context.messageIndices?.indexOf(index) ?? (context.messageIndices === undefined ? index : -1);
  if (visible >= 0 && visible < context.messages.length) return context.messages[visible];
  context.missingMessageIndices?.add(index);
  return undefined;
}

function recent(context: MacroContext, count: number) {
  const first = Math.max(0, context.messageCount - count);
  const messages = Array.from({ length: context.messageCount - first }, (_, i) => messageAt(context, first + i));
  return messages.some((message) => !message) ? null : messages as NonNullable<(typeof messages)[number]>[];
}

const lastMessageMacro: MacroDefinition = {
  name: "lastmessage",
  aliases: ["lastmsg", "lastchatmessage", "lastchatmsg"],
  description: "Content of the most recent message",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const lastMsg = context.messageCount ? messageAt(context, context.messageCount - 1) : undefined;
    return { value: lastMsg?.content || "", success: true };
  },
};

const lastUserMessageMacro: MacroDefinition = {
  name: "lastusermessage",
  aliases: ["lastuser"],
  description: "Content of the most recent user message",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    if (context.lastUserMessageIndex !== undefined) return { value: messageAt(context, context.lastUserMessageIndex)?.content ?? "", success: true };
    for (let i = context.messages.length - 1; i >= 0; i--) if (context.messages[i]?.role === "user") return { value: context.messages[i]!.content, success: true };
    return { value: "", success: true };
  },
};

const lastCharMessageMacro: MacroDefinition = {
  name: "lastcharmessage",
  aliases: ["lastchar", "lastassistant", "lastai"],
  description: "Content of the most recent character/assistant message",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    if (context.lastAssistantMessageIndex !== undefined) return { value: messageAt(context, context.lastAssistantMessageIndex)?.content ?? "", success: true };
    for (let i = context.messages.length - 1; i >= 0; i--) if (context.messages[i]?.role === "assistant") return { value: context.messages[i]!.content, success: true };
    return { value: "", success: true };
  },
};

const messageCountMacro: MacroDefinition = {
  name: "messagecount",
  aliases: ["msgcount", "chatlen", "chatlength"],
  description: "Total number of messages in the chat",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.messageCount.toString(), success: true }),
};

/** {{message::N}}: message at index (0 = first, -1 = last). */
const messageMacro: MacroDefinition = {
  name: "message",
  aliases: ["msg"],
  description: "Get message at index (0 = first, -1 = last)",
  args: [{ name: "index", description: "Message index", required: true }],
  category: "chat",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const index = parseInt(args[0] ?? "", 10);
    if (Number.isNaN(index)) return { value: "", success: false, error: "Invalid message index" };
    const actualIndex = index < 0 ? context.messageCount + index : index;
    if (actualIndex < 0 || actualIndex >= context.messageCount) return { value: "", success: true };
    return { value: messageAt(context, actualIndex)?.content ?? "", success: true };
  },
};

const userMessageCountMacro: MacroDefinition = {
  name: "usermessagecount",
  aliases: ["usercount"],
  description: "Number of user messages in the chat",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: (context.userMessageCount ?? context.messages.filter((m) => m.role === "user").length).toString(),
    success: true,
  }),
};

const charMessageCountMacro: MacroDefinition = {
  name: "charmessagecount",
  aliases: ["charcount", "aicount"],
  description: "Number of character/assistant messages in the chat",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: (context.assistantMessageCount ?? context.messages.filter((m) => m.role === "assistant").length).toString(),
    success: true,
  }),
};

const chatIdMacro: MacroDefinition = {
  name: "chatid",
  aliases: ["sessionid"],
  description: "Unique identifier for the current chat session",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.chatId || "", success: true }),
};

const chatStartMacro: MacroDefinition = {
  name: "chatstart",
  description: "When the chat session started",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    if (!context.chatStartTime) return { value: "", success: true };
    return { value: new Date(context.chatStartTime).toISOString(), success: true };
  },
};

/**
 * {{firstmessage}}: content of the very first message. Also carries the `greeting` alias
 * character.ts's dead duplicate contributed; see character.ts's header.
 */
const firstMessageMacro: MacroDefinition = {
  name: "firstmessage",
  aliases: ["firstmsg", "greeting"],
  description: "Content of the very first message in the chat",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    if (context.firstMessage) return { value: context.firstMessage, success: true };
    if (context.messageIndices !== undefined) return { value: messageAt(context, 0)?.content ?? "", success: true };
    return { value: context.messages[0]?.content || "", success: true };
  },
};

const recentMessagesMacro: MacroDefinition = {
  name: "recentmessages",
  aliases: ["recent"],
  description: "Get last N messages formatted",
  args: [{ name: "count", description: "Number of messages", required: true }],
  category: "chat",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const count = parseInt(args[0] ?? "", 10);
    if (Number.isNaN(count) || count < 1) return { value: "", success: false, error: "Invalid message count" };
    const messages = recent(context, count);
    if (!messages) return { value: "", success: true };
    const formatted = messages.map((m) => `${m.role === "user" ? context.userName : context.characterName}: ${m.content}`).join("\n");
    return { value: formatted, success: true };
  },
};

/**
 * {{message history}}: conversation history, formatted, token-aware (see header deviation).
 * `{{message_history::budget}}` / `{{message_history::budget::maxCount}}`.
 */
const messageHistoryMacro: MacroDefinition = {
  name: "message history",
  aliases: ["history", "chatlog", "chat_history"],
  description: "Conversation history formatted (token-aware)",
  category: "chat",
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.messageCount === 0) return { value: "", success: true };

    const tokenBudget = args.length > 0 ? parseInt(args[0] ?? "", 10) : 2000;
    const maxCount = args.length > 1 ? parseInt(args[1] ?? "", 10) : 50;
    if (!Number.isFinite(maxCount) || maxCount < 1) return { value: "", success: false, error: "Invalid message count" };
    const messages = recent(context, maxCount);
    if (!messages) return { value: "", success: true };

    const header = "=== MESSAGE HISTORY ===\n";
    const footer = "\n======================\n";
    let usedTokens = estimateTokens(header) + estimateTokens(footer);

    // RoleCall's shape, kept for parity (findings): the loop already
    // builds oldest-first, so the reverse below puts the NEWEST message first despite RoleCall's
    // comment, and a truncated message carries its speaker prefix twice.
    const selected: Array<{ speaker: string; content: string }> = [];
    for (let i = messages.length - 1; i >= 0 && selected.length < maxCount; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const speaker = msg.role === "user" ? context.userName : context.characterName;
      const messageText = `${speaker}: ${msg.content}`;
      const messageTokens = estimateTokens(messageText);
      if (usedTokens + messageTokens > tokenBudget) {
        const remainingBudget = tokenBudget - usedTokens - 3;
        if (remainingBudget > 10) {
          const truncatedText = `${speaker}: ${msg.content.substring(0, remainingBudget * 4)}...`;
          selected.unshift({ speaker, content: truncatedText });
          usedTokens += estimateTokens(truncatedText);
        }
        break;
      }
      selected.unshift({ speaker, content: msg.content });
      usedTokens += messageTokens;
    }

    if (selected.length === 0) return { value: "", success: true };
    const lines = selected.reverse().map((m) => `${m.speaker}: ${m.content}`);
    return { value: header + lines.join("\n") + footer, success: true };
  },
};

const lastMessageIdMacro: MacroDefinition = {
  name: "lastmessageid",
  aliases: ["lastmsgid", "lastmsgindex"],
  description: "Index of the last message (0-based)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: Math.max(0, context.messageCount - 1).toString(),
    success: true,
  }),
};

const firstIncludedMessageIdMacro: MacroDefinition = {
  name: "firstincludedmessageid",
  aliases: ["firstincludedmsgid"],
  description: "Index of first message included in context (oldest sent to AI)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: ((context as SceneExtendedContext).firstIncludedMessageId ?? 0).toString(),
    success: true,
  }),
};

const firstDisplayedMessageIdMacro: MacroDefinition = {
  name: "firstdisplayedmessageid",
  aliases: ["firstdisplayedmsgid"],
  description: "Index of first displayed message in UI",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: ((context as SceneExtendedContext).firstDisplayedMessageId ?? 0).toString(),
    success: true,
  }),
};

const summaryMacro: MacroDefinition = {
  name: "summary",
  aliases: ["chatsummary"],
  description: "Latest auto-generated chat summary",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.chatSummary || "", success: true }),
};

const lastSwipeIdMacro: MacroDefinition = {
  name: "lastswipeid",
  aliases: ["swipecount"],
  description: "Total number of swipes available (1-based)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: ((context as SceneExtendedContext).lastSwipeId ?? 1).toString(),
    success: true,
  }),
};

const currentSwipeIdMacro: MacroDefinition = {
  name: "currentswipeid",
  aliases: ["swipeid"],
  description: "Current swipe index (1-based)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: ((context as SceneExtendedContext).currentSwipeId ?? 1).toString(),
    success: true,
  }),
};

/** Swipe/context-window fields with no home on the trimmed base `MacroContext`. */
export interface SceneExtendedContext extends MacroContext {
  firstIncludedMessageId?: number;
  firstDisplayedMessageId?: number;
  lastSwipeId?: number;
  currentSwipeId?: number;
}

/** {{memories}}: chat memory summaries, token-aware (see header deviation). */
const memoriesMacro: MacroDefinition = {
  name: "memories",
  aliases: ["memory"],
  description: "Chat memory summaries as context (token-aware)",
  category: "chat",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const memories = context.chatMemories || [];
    if (memories.length === 0) return { value: "", success: true };

    const tokenBudget = args.length > 0 ? parseInt(args[0] ?? "", 10) : 1500;
    const maxCount = args.length > 1 ? parseInt(args[1] ?? "", 10) : 100;

    const header = "=== CHAT MEMORIES ===\n";
    const footer = "\n=====================\n";
    let usedTokens = estimateTokens(header) + estimateTokens(footer);

    const selected: string[] = [];
    for (let i = memories.length - 1; i >= 0 && selected.length < maxCount; i--) {
      const memory = memories[i];
      if (memory === undefined) continue;
      const memoryText = `- ${memory}`;
      const memoryTokens = estimateTokens(memoryText);
      if (usedTokens + memoryTokens > tokenBudget) {
        const remainingBudget = tokenBudget - usedTokens - 3;
        if (remainingBudget > 10) {
          const truncated = `- ${memory.substring(0, remainingBudget * 4)}...`;
          selected.unshift(truncated);
          usedTokens += estimateTokens(truncated);
        }
        break;
      }
      selected.unshift(memoryText);
      usedTokens += memoryTokens;
    }

    if (selected.length === 0) return { value: "", success: true };
    // RoleCall reverses an already oldest-first list, so the newest memory comes first (kept for parity).
    return { value: header + selected.reverse().join("\n") + footer, success: true };
  },
};

export const SCENE_MACROS: readonly MacroDefinition[] = [
  lastMessageMacro,
  lastUserMessageMacro,
  lastCharMessageMacro,
  messageCountMacro,
  messageMacro,
  userMessageCountMacro,
  charMessageCountMacro,
  chatIdMacro,
  chatStartMacro,
  firstMessageMacro,
  recentMessagesMacro,
  messageHistoryMacro,
  lastMessageIdMacro,
  firstIncludedMessageIdMacro,
  firstDisplayedMessageIdMacro,
  summaryMacro,
  lastSwipeIdMacro,
  currentSwipeIdMacro,
  memoriesMacro,
];
