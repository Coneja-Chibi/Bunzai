/**
 * Compare takes: two takes of one scene read side by side from the message where they part. RoleCall's Branching Tree has no compare;
 * this is the tree row's detail, read only, and the words inside a pair are marked by the same word diff Final Cut uses (core/final-cut/diff.ts),
 * on the page. Messages the takes share (the same role and words, from the start; a fork copies messages under new ids) are counted, not sent; the rest are lined up by position.
 */
import type { ChatStore } from "../stage/contracts/chat-store";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { WHOLE_BRANCH } from "./scene-branch";

/** How many diverging positions one comparison carries. */
export const COMPARE_ROWS = 200;

export interface CompareSide { id: string; role: string; text: string }
export interface TakeComparison {
  a: { id: string; name: string; messages: number };
  b: { id: string; name: string; messages: number };
  /** Messages both takes start with. */
  shared: number;
  rows: { a: CompareSide | null; b: CompareSide | null }[];
  truncated: boolean;
}

export async function compareTakes(chats: ChatStore, input: { chatId: string; a: string; b: string }): Promise<TakeComparison> {
  if (input.a === input.b) throw new StudioValidationError("pick two different takes to compare");
  const branches = await chats.listBranches(input.chatId);
  const find = (id: string) => {
    const branch = branches.find((x) => x.id === id);
    if (!branch) throw new StudioNotFoundError("that take is not in this scene");
    return branch;
  };
  const [a, b] = [find(input.a), find(input.b)];
  const read = async (id: string): Promise<CompareSide[]> => (await chats.readMessages(id, { limit: WHOLE_BRANCH })).messages
    .filter((m) => !m.cut)
    .map((m) => ({ id: m.id, role: m.role, text: m.swipes[m.current]?.content ?? "" }));
  const [ma, mb] = [await read(a.id), await read(b.id)];
  let shared = 0;
  while (shared < ma.length && shared < mb.length && ma[shared]!.role === mb[shared]!.role && ma[shared]!.text === mb[shared]!.text) shared++;
  const span = Math.max(ma.length, mb.length) - shared;
  const rows = Array.from({ length: Math.min(span, COMPARE_ROWS) }, (_, i) => ({ a: ma[shared + i] ?? null, b: mb[shared + i] ?? null }));
  return { a: { id: a.id, name: a.name, messages: ma.length }, b: { id: b.id, name: b.name, messages: mb.length }, shared, rows, truncated: span > COMPARE_ROWS };
}
