/** Shared factories for engine/*.test.ts. Not part of the public API. */
import type { LorebookBody, LorebookEntry } from "../../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "../empty-book";
import type { LoreBookInput, LoreScan, LoreScanMessage } from "./types";

export const entry = (id: string, patch: Partial<LorebookEntry> = {}): LorebookEntry => ({
  ...emptyLoreEntry(id),
  ...patch,
  id,
});

export const bookOf = (entries: LorebookEntry[], patch: Partial<LorebookBody> = {}): LorebookBody => ({
  ...emptyLorebookBody("book"),
  entries,
  ...patch,
});

export const book = (id: string, entries: LorebookEntry[], patch: Partial<LorebookBody> = {}): LoreBookInput => ({
  id,
  name: id,
  body: bookOf(entries, patch),
});

export const msg = (content: string, role: LoreScanMessage["role"] = "user", at?: number): LoreScanMessage => ({
  role,
  content,
  ...(at === undefined ? {} : { at }),
});

export const scan = (patch: Partial<LoreScan> = {}): LoreScan => ({
  messages: [],
  messageCount: 1,
  character: { name: "Aria", tags: [], description: "", personality: "", scenario: "" },
  persona: "",
  generationType: "normal",
  variables: {},
  now: 1_700_000_000_000,
  ...patch,
});

/** Deterministic sequence rng for tests: cycles through the given values (default: always 0). */
export function fakeRng(values: number[] = [0]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] as number;
    i++;
    return v;
  };
}

export const countChars = (text: string): number => text.length;
