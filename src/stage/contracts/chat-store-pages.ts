/** The page shapes of ChatStore's bounded transcript reads and its transcript search. Re-exported by chat-store.ts. */
import type { Message, MessageRole, Swipe } from "./chat-store";

export interface MessagePage {
  messages: Message[];
  /** The sequence to read from next, or null when the branch has no more. */
  nextSeq: number | null;
  /** The branch's version at the time of this read, or null when the branch does not exist. */
  branchVersion: number | null;
}

/** A chronological page ending before a sequence cursor, with the live ordinal at its first row. */
export interface MessageTailPage extends MessagePage {
  beforeCount: number;
  totalCount: number;
  userCount: number;
  assistantCount: number;
  lastUserIndex: number | null;
  lastAssistantIndex: number | null;
}

export interface MessageAtIndex { index: number; role: MessageRole; content: string }

export interface MessageAtPage {
  messages: MessageAtIndex[];
  branchVersion: number | null;
}

export interface MessageSwipePage {
  branchId: string | null;
  branchVersion: number | null;
  messageId: string;
  index: number;
  swipeCount: number;
  swipe: Swipe | null;
}

export interface TranscriptSwipeSelection {
  branchId: string;
  branchVersion: number;
  swipeCount: number;
}

/** What a search asks: every word (lower or upper case, no spaces, 2 or more characters) must be in the text; at most `limit` matches. */
export interface TranscriptSearchQuery {
  words: string[];
  limit: number;
}

/** One live message whose shown version holds every word, with its live ordinal (the position `readMessagesAt` takes). */
export interface TranscriptHit {
  messageId: string;
  seq: number;
  index: number;
  role: MessageRole;
  /** Epoch ms. */
  createdAt: number;
  /** Left out of the prompt but still shown to the reader (rule 30). */
  hidden: boolean;
  content: string;
}

export interface TranscriptSearchPage {
  /** Newest first. */
  hits: TranscriptHit[];
  /** More matches exist than `limit`. */
  truncated: boolean;
  /** How many live messages the take holds. */
  totalCount: number;
  /** The take's version at the time of this read, or null when the take does not exist. */
  branchVersion: number | null;
}
