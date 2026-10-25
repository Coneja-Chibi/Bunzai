/** The transcript search's query rule and match rule, shared by the memory and SQLite stores. */
import type { TranscriptSearchQuery } from "../contracts/chat-store-pages";
import { MAX_SEARCH_HITS, MAX_SEARCH_WORDS, MAX_WORD, MIN_WORD } from "../../core/search/contracts";
import { fail } from "./chat-rules";
import { isWhole } from "./scalar-rules";

/** The words lower-cased and de-duplicated, and a whole-number limit; anything else is refused, never answered as empty. */
export function checkTranscriptSearch(query: TranscriptSearchQuery | undefined): { words: string[]; limit: number } {
  const words = query?.words;
  if (!Array.isArray(words) || words.length < 1 || words.length > MAX_SEARCH_WORDS) fail(`search needs 1 to ${MAX_SEARCH_WORDS} words`);
  const lowered = new Set<string>();
  for (const word of words) {
    if (typeof word !== "string" || word.length < MIN_WORD || word.length > MAX_WORD || /\s/.test(word)) {
      fail(`each search word must be ${MIN_WORD} to ${MAX_WORD} characters with no spaces`);
    }
    lowered.add(word.toLowerCase());
  }
  const limit = query?.limit;
  if (!isWhole(limit, 1, MAX_SEARCH_HITS)) fail(`search limit must be a whole number from 1 to ${MAX_SEARCH_HITS}`);
  return { words: [...lowered], limit };
}

/** True when the text holds every word, ignoring case. `words` come from checkTranscriptSearch (already lower case). */
export function holdsAllWords(content: string, words: readonly string[]): boolean {
  const lower = content.toLowerCase();
  return words.every((word) => lower.includes(word));
}
