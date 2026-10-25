/**
 * The Scenes list and a scene's chat summary (rc-parity 08, follow-up 2; RoleCall's summary "powers chat-card previews"): each card carries a short preview of the active take's summary,
 * and a search can find a scene by what its summary says. Only the active take's text counts, a scene with no summary adds nothing, and nothing is written.
 */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import { listScenes } from "./scenes";
import { PREVIEW_CHARS, searchSummaries, summaryPreview } from "./scene-summary-list";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const CAST = { character: { id: "vera", version: 1, name: "Vera" } };

async function scene(title: string, text?: string) {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title, cast: CAST, snapshot: { character: vera } });
  if (text) await chats.setSummary(chat.activeBranchId, { text, through: 1 });
  return { chats, chat };
}

describe("summaryPreview", () => {
  test("whitespace collapses to single spaces and a long text is cut with an ellipsis", () => {
    expect(summaryPreview("They met\n\nat   the pier.")).toBe("They met at the pier.");
    const cut = summaryPreview("word ".repeat(100));
    expect(cut.length).toBeLessThanOrEqual(PREVIEW_CHARS + 3);
    expect(cut.endsWith("...")).toBe(true);
  });
  test("nothing to say is nothing", () => {
    expect(summaryPreview("  \n ")).toBe("");
  });
});

describe("listScenes: summaryPreview", () => {
  test("a scene with a summary carries the preview of the active take's text; one without carries none", async () => {
    const a = await scene("A", "They met at the pier.\n\nThe tide was out.");
    expect((await listScenes(a.chats))[0]!.summaryPreview).toBe("They met at the pier. The tide was out.");
    const b = await scene("B");
    expect("summaryPreview" in (await listScenes(b.chats))[0]!).toBe(false);
  });
  test("another take's summary is not this take's preview", async () => {
    const { chats, chat } = await scene("A", "Main take text.");
    const [m] = (await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "hi" }]))!;
    const take = await chats.fork(chat.activeBranchId, m!.id, { name: "Take 2" });
    await chats.setActiveBranch(chat.id, take!.id);
    expect("summaryPreview" in (await listScenes(chats))[0]!).toBe(false);
    await chats.setSummary(take!.id, { text: "Fork text.", through: 1 });
    expect((await listScenes(chats))[0]!.summaryPreview).toBe("Fork text.");
  });
});

describe("searchSummaries", () => {
  test("finds the scenes whose active take's summary has every word, in any case, and no other", async () => {
    const { chats, chat } = await scene("A", "They met at the Pier. The tide was out.");
    const other = await chats.createChat({ title: "B", cast: CAST, snapshot: { character: vera } });
    await chats.setSummary(other.activeBranchId, { text: "A quiet harbour.", through: 1 });
    expect(await searchSummaries(chats, "pier TIDE")).toEqual([chat.id]);
    expect(await searchSummaries(chats, "harbour")).toEqual([other.id]);
    expect(await searchSummaries(chats, "pier harbour")).toEqual([]);
  });
  test("a query with no word of two characters finds nothing, and a scene with no summary is never found", async () => {
    const { chats } = await scene("A");
    expect(await searchSummaries(chats, "a")).toEqual([]);
    expect(await searchSummaries(chats, "anything")).toEqual([]);
  });
});
