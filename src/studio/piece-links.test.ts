/** Where a library piece is linked: the live scenes whose prompting names it, read from settings alone. */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import { linkableKinds, scenesLinking } from "./piece-links";

const CAST = { character: { id: "vera", version: 1 } };
const SNAP = { character: { kind: "character", id: "vera", body: {} } } as never;

async function scenes() {
  const chats = memoryChatStore(() => 1_000);
  const make = (title: string) => chats.createChat({ title, cast: CAST, snapshot: SNAP });
  return { chats, make };
}

describe("scenesLinking", () => {
  test("names the live scenes that link a tracker, and a tool, each by its own list", async () => {
    const { chats, make } = await scenes();
    const a = await make("Harbour");
    const b = await make("Market");
    await make("Quiet");
    await chats.setPrompting(a.id, { trackers: ["health", "party"], tools: ["luck"] });
    await chats.setPrompting(b.id, { trackers: ["health"] });
    expect(await scenesLinking(chats, "tracker", "health")).toEqual([{ chatId: a.id, title: "Harbour" }, { chatId: b.id, title: "Market" }]);
    expect(await scenesLinking(chats, "tracker", "party")).toEqual([{ chatId: a.id, title: "Harbour" }]);
    expect(await scenesLinking(chats, "tool", "luck")).toEqual([{ chatId: a.id, title: "Harbour" }]);
    // a tool id is not a tracker id, even when the names match
    expect(await scenesLinking(chats, "tool", "health")).toEqual([]);
    expect(await scenesLinking(chats, "tracker", "nobody")).toEqual([]);
  });

  test("leaves out a deleted scene, which waits in the trash", async () => {
    const { chats, make } = await scenes();
    const live = await make("Live");
    const gone = await make("Gone");
    await chats.setPrompting(live.id, { trackers: ["health"] });
    await chats.setPrompting(gone.id, { trackers: ["health"] });
    await chats.deleteChat(gone.id);
    expect(await scenesLinking(chats, "tracker", "health")).toEqual([{ chatId: live.id, title: "Live" }]);
  });

  test("has no cap: every scene that links it is named", async () => {
    const { chats, make } = await scenes();
    const all = await Promise.all(Array.from({ length: 120 }, (_, i) => make(`Scene ${i}`)));
    for (const c of all) await chats.setPrompting(c.id, { tools: ["luck"] });
    expect(await scenesLinking(chats, "tool", "luck")).toHaveLength(120);
  });
});

describe("which kinds a scene links", () => {
  test("is the kind hub's say: a kind with no prompting list is not asked", async () => {
    const { chats } = await scenes();
    expect(await scenesLinking(chats, "preset", "x")).toBeNull();
    expect(linkableKinds().sort()).toEqual(["tool", "tracker"]);
  });
});
