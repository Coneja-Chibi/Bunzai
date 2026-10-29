/**
 * The Trash over HTTP: GET /api/studio/trash lists deleted pieces, POST /api/studio/restore brings
 * one back under its own id, and a grave that is gone answers 404. Overwriting a deleted piece
 * answers 404 too, never a silent copy (behavior 10).
 */
import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { testCharacter } from "../studio/test-character";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const vera = testCharacter("vera", [], { name: "Vera" });

test("delete, list the Trash, restore home, and a second restore is a 404", async () => {
  const root = await mkdtemp(join(tmpdir(), "bunzai-trash-route-"));
  roots.push(root);
  const content = createContentStore(memoryDocumentBackend());
  const store = new StudioStore(root, () => content);
  const security = filledSec();
  const handler = createHandler(store, new SettingsStore(root), undefined, security);
  const post = (path: string, body: unknown) =>
    apiReq(path, { method: "POST", token: security.token, contentType: "application/json", body: JSON.stringify(body) });
  await store.save(vera);
  await store.delete("character", "vera");

  const trash = (await (await handler(apiReq("/api/studio/trash"))).json()) as { graveId: string; id: string; name: string }[];
  expect(trash).toMatchObject([{ id: "vera", name: "Vera" }]);

  const overwrite = await handler(post("/api/studio/save", { entity: vera, overwrite: true }));
  expect(overwrite.status).toBe(404);

  const back = await handler(post("/api/studio/restore", { graveId: trash[0]!.graveId }));
  expect(back.status).toBe(200);
  expect(await back.json()).toMatchObject({ id: "vera", kind: "character" });
  expect(await store.read("character", "vera")).not.toBeNull();
  expect((await handler(post("/api/studio/restore", { graveId: trash[0]!.graveId }))).status).toBe(404);
  expect((await handler(post("/api/studio/restore", { nope: 1 }))).status).toBe(400);
});
