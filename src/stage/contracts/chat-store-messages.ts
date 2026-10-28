/**
 * The ChatStore's message shapes: a message, its versions (swipes) with how each was generated, and a version in the Trash. Split from chat-store.ts for the file-size cap and re-exported from it,
 * so every import of these types from "./chat-store" is unchanged, the way chat-store-pages.ts holds the page shapes. Shapes follow RoleCall's stored ChatMessage and SwipeData. Types only.
 */

/** RoleCall's stored message roles. */
export type MessageRole = "user" | "assistant" | "system";

/** How a generated swipe was made: RoleCall's SwipeData generation fields, minus RoleCall-only ones. */
export interface Generation {
  model?: string;
  /** The provider's stop reason, shown so a reader can see why a reply looks cut short. */
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  generationMs?: number;
  /** How long the native reasoning channel ran (first token to first reply token), and how long the reply's own tags held thinking; absent on imports and older replies. */
  reasoningMs?: number; tagThinkingMs?: number;
  presetName?: string;
  /** A guided re-roll's instruction, kept so "Edit guided re-roll" can offer it again (rc-parity 03 slice 5). */
  guidance?: string;
  samplers?: Record<string, number | string | boolean>;
  /** Native reasoning, sent back only to the same model that produced it (pipeline-hooks behavior 7). */
  reasoning?: { text: string; signature?: string; provider?: string; model?: string };
  /** The Start Reply With text this reply was written after, when it was sent as the assistant's own opening (RoleCall's Show Prefill in Chat shows it; the reply itself is stored without it). */
  prefill?: string;
  /** Smart Recovery: where in the stored reply the thinking a helper model found ends, as a character offset. */
  thinkingEnd?: number;
  /** What Final Cut did to this reply (rule 44): passes that ran, whether the text changed, and how many failed; the details are in the swipe's trace. */
  finalCut?: { passes: number; changed: boolean; failed: number };
  /** The macros the prompt build ran out of time on while this reply was built (core/assembly/macro-report.ts outOfTimeOf); absent when none did. */
  outOfTime?: { macro: string }[];
}

export interface Swipe {
  id: string;
  content: string;
  /** Epoch ms. */
  createdAt: number;
  pinned: boolean;
  generation?: Generation;
}

/** A version removed from its message and waiting in the Trash (spec rule 32); times are epoch ms. */
export interface CutSwipe { messageId: string; swipeId: string; branchId: string; chatId: string; seq: number; content: string; createdAt: number; cutAt: number }

export interface Message {
  id: string;
  branchId: string;
  seq: number;
  role: MessageRole;
  /** The message's live versions, oldest first; a removed one is not here (spec rule 32). */
  swipes: Swipe[];
  /** Index into `swipes` of the swipe the reader sees and the prompt uses. */
  current: number;
  /** Epoch ms. */
  createdAt: number;
  /**
   * Who the person was playing when they wrote this user message (spec rule 26): the scene's persona at
   * that moment, `null` for "no persona". Absent on messages from before the stamp, on replies, and
   * when the persona ref carried no name; a reader then falls back to the scene's current persona.
   */
  persona?: { id: string; name: string } | null;
  /** True while the message is shown but left out of the prompt (spec rule 30); absent otherwise. */
  hidden?: true;
  /** Set while the message is cut: it stays in place, restorable until the purge (spec rule 11). */
  cut?: { id: string; at: number };
  /** Present on bounded transcript pages: `swipes` contains only the selected cell. */
  transcript?: { currentIndex: number; swipeCount: number };
}
