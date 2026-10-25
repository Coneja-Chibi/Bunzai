/**
 * The loadout routes over HTTP, on the real encrypted library: the scene's live settings, the loadout library (make,
 * change, list, delete softly, restore, refuse bad input and a full library), and a receipt's save, finish and undo.
 * Every refusal is a status and a message, never an empty success; the same-site and token guards apply as to any /api route.
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { LOADOUT_CAP } from "../core/loadout-panels";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);
setDefaultTimeout(60_000);

const get = (handler: (r: Request) => Promise<Response>, path: string, fetchSite?: string) => handler(apiReq(path, { ...(fetchSite ? { fetchSite } : {}) }));
const loadout = { name: "Slow burn", values: { guides: ["g1"], authorNote: null } };

test("a scene's live settings are answered from the store, with the persona's id, and a missing scene is a 404", async () => {
  const { store, handler, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  expect(await (await get(handler, `/api/chats/settings?chatId=${chat.id}`)).json()).toEqual({ persona: null });
  await post("/api/chats/lore", { chatId: chat.id, lore: { added: ["b1"], off: [] } });
  await post("/api/chats/prompting", { chatId: chat.id, prompting: { guides: ["g1"] } });
  expect(await (await get(handler, `/api/chats/settings?chatId=${chat.id}`)).json()).toEqual({ lore: { added: ["b1"], off: [] }, prompting: { guides: ["g1"] }, persona: null });
  expect((await get(handler, "/api/chats/settings?chatId=nope")).status).toBe(404);
  expect((await get(handler, "/api/chats/settings")).status).toBe(400);
});

test("loadouts are made, listed, changed, deleted softly and restored over HTTP, and bad input is refused with a message", async () => {
  const { handler, post } = await rig();
  expect(await (await get(handler, "/api/chats/loadouts")).json()).toEqual([]);
  const made = (await (await post("/api/chats/loadouts/save", { loadout })).json()) as { id: string; panels: string[] };
  expect(made.panels).toEqual(["authorNote", "guides"]);
  const edited = (await (await post("/api/chats/loadouts/save", { loadout: { id: made.id, name: "Slower", values: { persona: "p" } } })).json()) as { name: string };
  expect(edited.name).toBe("Slower");
  expect(((await (await get(handler, "/api/chats/loadouts")).json()) as { name: string }[]).map((l) => l.name)).toEqual(["Slower"]);

  const bad = await post("/api/chats/loadouts/save", { loadout: { name: "x", values: { guides: "g1" } } });
  expect(bad.status).toBe(400);
  expect(((await bad.json()) as { error: string }).error).toContain("guides");
  expect((await post("/api/chats/loadouts/save", {})).status).toBe(400);
  expect((await post("/api/chats/loadouts/save", { loadout: { id: "nope", name: "x", values: {} } })).status).toBe(404);

  expect(await (await post("/api/chats/loadouts/delete", { id: made.id })).json()).toEqual({ deleted: true });
  expect(await (await get(handler, "/api/chats/loadouts")).json()).toEqual([]);
  expect(((await (await get(handler, "/api/chats/loadouts?removed=1")).json()) as { id: string }[]).map((l) => l.id)).toEqual([made.id]);
  expect(((await (await post("/api/chats/loadouts/restore", { id: made.id })).json()) as { id: string }).id).toBe(made.id);
  expect((await post("/api/chats/loadouts/restore", { id: made.id })).status).toBe(404);
  expect((await post("/api/chats/loadouts/delete", {})).status).toBe(400);
  expect((await post("/api/chats/loadouts/restore", { id: 4 })).status).toBe(400);
});

test("the 101st loadout is a 409 with the plain message", async () => {
  const { handler, post } = await rig();
  for (let i = 0; i < LOADOUT_CAP; i++) await post("/api/chats/loadouts/save", { loadout: { name: `L${i}`, values: {} } });
  const refused = await post("/api/chats/loadouts/save", { loadout: { name: "One too many", values: {} } });
  expect(refused.status).toBe(409);
  expect(((await refused.json()) as { error: string }).error).toBe("You have 100 loadouts. Delete one first.");
  expect(((await (await get(handler, "/api/chats/loadouts")).json()) as unknown[]).length).toBe(LOADOUT_CAP);
}, 120_000);

const receipt = {
  code: "LD-1", chatId: "c1", loadoutId: "l1", loadoutName: "Slow burn", appliedAt: 0, undoUntil: 0,
  rows: [{ unit: "lore", panels: ["lorebooks"], state: "pending" }],
  before: { lore: null }, after: { lore: { added: ["b"], off: [] } },
};

test("a receipt is saved, finished and undone over HTTP, and the scene's open one comes back until it is undone", async () => {
  const { handler, post } = await rig();
  expect(await (await get(handler, "/api/chats/loadouts/receipt?chatId=c1")).json()).toBeNull();
  const saved = (await (await post("/api/chats/loadouts/receipt", { receipt })).json()) as { appliedAt: number; undoUntil: number };
  expect(saved.undoUntil - saved.appliedAt).toBe(15 * 60 * 1000);
  const rows = [{ unit: "lore", panels: ["lorebooks"], state: "applied" }];
  expect(((await (await post("/api/chats/loadouts/receipt-finish", { code: "LD-1", rows })).json()) as { rows: unknown }).rows).toEqual(rows);
  expect(((await (await get(handler, "/api/chats/loadouts/receipt?chatId=c1")).json()) as { code: string }).code).toBe("LD-1");
  expect(((await (await post("/api/chats/loadouts/receipt-undone", { code: "LD-1" })).json()) as { undoneAt: number }).undoneAt).toBeGreaterThan(0);
  expect(await (await get(handler, "/api/chats/loadouts/receipt?chatId=c1")).json()).toBeNull();
  const again = await post("/api/chats/loadouts/receipt-undone", { code: "LD-1" });
  expect(again.status).toBe(409);
  expect(((await again.json()) as { error: string }).error).toBe("That loadout was already undone.");
});

test("a bad receipt, an unknown code and a missing field are refused, never answered as success", async () => {
  const { handler, post } = await rig();
  expect((await post("/api/chats/loadouts/receipt", { receipt: { ...receipt, rows: [{ unit: "zzz", panels: [], state: "applied" }] } })).status).toBe(400);
  expect((await post("/api/chats/loadouts/receipt", {})).status).toBe(400);
  expect((await post("/api/chats/loadouts/receipt-finish", { code: "nope", rows: [] })).status).toBe(404);
  expect((await post("/api/chats/loadouts/receipt-finish", { rows: [] })).status).toBe(400);
  expect((await post("/api/chats/loadouts/receipt-undone", { code: "nope" })).status).toBe(404);
  expect((await post("/api/chats/loadouts/receipt-undone", {})).status).toBe(400);
  expect((await get(handler, "/api/chats/loadouts/receipt")).status).toBe(400);
});

test("a foreign page cannot read, and a write without the session token is refused", async () => {
  const { handler } = await rig();
  expect((await get(handler, "/api/chats/loadouts", "same-site")).status).toBe(403);
  expect((await get(handler, "/api/chats/settings?chatId=x", "cross-site")).status).toBe(403);
  const noToken = await handler(apiReq("/api/chats/loadouts/save", { method: "POST", contentType: "application/json", body: JSON.stringify({ loadout }) }));
  expect(noToken.status).toBe(403);
  expect(await (await get(handler, "/api/chats/loadouts")).json()).toEqual([]);
});
