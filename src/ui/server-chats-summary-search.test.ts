/** `GET /api/chats/summary-search?q=` (rc-parity 08, follow-up 2): the scenes whose active take's chat summary holds every word, for the Scenes list's search. A read only. */
import { afterEach, expect, test } from "bun:test";
import { libraryChatsFor } from "../studio/library-content";
import type { OpenScene } from "../studio/scenes";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

test("finds the scene by what its summary says, and a card's list entry carries the preview", async () => {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const chats = libraryChatsFor(r.store.studioPath())!;
  const opened = (await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene;
  await chats.setSummary(opened.chat.activeBranchId, { text: "They met at the pier.", through: 1 });
  const found = await r.handler(apiReq("/api/chats/summary-search?q=PIER"));
  expect(found.status).toBe(200);
  expect(await found.json()).toEqual({ ids: [id] });
  expect(await (await r.handler(apiReq("/api/chats/summary-search?q=lighthouse"))).json()).toEqual({ ids: [] });
  expect(await (await r.handler(apiReq("/api/chats/summary-search"))).json()).toEqual({ ids: [] });
  const listed = (await (await r.handler(apiReq("/api/chats/list"))).json()) as { summaryPreview?: string }[];
  expect(listed[0]!.summaryPreview).toBe("They met at the pier.");
});
