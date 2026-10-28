/**
 * `GET /api/chats/variable-history` (rc-parity 08, State's per-variable history): the changes one variable went through over the take's replies, read from the `variables`
 * record each reply's trace stored. Newest first; a reply from before the record, or one that left the variable alone, says nothing. A read only.
 */
import { expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import type { JsonObject } from "../stage/contracts/chat-store";
import { handleVariableHistoryRoute } from "./server-chats-variable-history";
import type { VariableHistory } from "./app-contract-scenes";

const CHAR = { kind: "character", id: "vera", body: { identity: { name: "Vera" } } };
const trace = (variables?: JsonObject[]): JsonObject => ({ estimate: { mid: 1, bound: 1, samples: 0 }, blocks: [], budget: { budgeter: "app", trimmed: [], finalPassDropped: 0 }, request: { model: "m" }, window: { context: 1000, reply: 100, stated: true }, ...(variables ? { variables } : {}) });

async function rig(replies: (JsonObject[] | undefined)[]) {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: CHAR } });
  for (const [i, variables] of replies.entries()) {
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: `turn ${i}` });
    const t = await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
    await chats.commitTurn(t!.id, { content: `reply ${i}`, trace: trace(variables) });
  }
  return { chats, chat };
}
const ask = async (chats: ReturnType<typeof memoryChatStore>, chatId: string, scope: string, key: string): Promise<Response> =>
  handleVariableHistoryRoute(new URL(`http://local/api/chats/variable-history?chatId=${chatId}&scope=${scope}&key=${encodeURIComponent(key)}`), chats);

test("the variable's changes, newest first, each with the reply's number and what it was before and after", async () => {
  const { chats, chat } = await rig([
    [{ scope: "local", key: "mood", after: "calm" }, { scope: "local", key: "other", after: 1 }],
    undefined,
    [{ scope: "local", key: "mood", before: "calm", after: "wary" }],
    [{ scope: "global", key: "mood", before: 1, after: 2 }, { scope: "local", key: "mood", before: "wary", deleted: true }],
  ]);
  const out = (await (await ask(chats, chat.id, "local", "mood")).json()) as VariableHistory;
  expect(out.entries.map((e) => [e.number, e.before, e.after, e.deleted])).toEqual([[8, "wary", undefined, true], [6, "calm", "wary", undefined], [2, undefined, "calm", undefined]]);
  expect(typeof out.entries[0]!.at).toBe("number");
  expect(out.truncated).toBe(false);
});

test("a global is asked for by its own scope, and a variable no reply touched has no entries", async () => {
  const { chats, chat } = await rig([[{ scope: "global", key: "gold", before: 1, after: 2 }]]);
  expect(((await (await ask(chats, chat.id, "global", "gold")).json()) as VariableHistory).entries).toHaveLength(1);
  expect(((await (await ask(chats, chat.id, "local", "gold")).json()) as VariableHistory).entries).toEqual([]);
});

test("a bad scope or key is refused, an unknown scene is 404, and nothing is written", async () => {
  const { chats, chat } = await rig([]);
  expect((await ask(chats, chat.id, "nowhere", "x")).status).toBe(400);
  expect((await ask(chats, chat.id, "local", "")).status).toBe(400);
  expect((await ask(chats, "nope", "local", "x")).status).toBe(404);
});

test("owner rule (limits rework): a large local change is saved like any other, so it is history; there is no refused marker to leave it out", async () => {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: CHAR } });
  await chats.appendMessage(chat.activeBranchId, { role: "user", content: "go" });
  const t = await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
  const changes = [{ scope: "local", key: "mood", after: "calm" }, { scope: "global", key: "gold", after: 2 }];
  await chats.commitTurn(t!.id, { content: "reply", trace: trace(changes) });
  expect(((await (await ask(chats, chat.id, "local", "mood")).json()) as VariableHistory).entries).toHaveLength(1);
  expect(((await (await ask(chats, chat.id, "global", "gold")).json()) as VariableHistory).entries).toHaveLength(1);
});
