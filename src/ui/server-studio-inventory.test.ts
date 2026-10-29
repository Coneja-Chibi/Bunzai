/**
 * Studio inventory reports healthy and damaged pieces through the read-only HTTP boundary. The
 * damage is a row in the library whose sealed body no longer parses, planted straight into the
 * library's backend, which is the only way a piece can be damaged once it lives in the library.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { buildPartText } from "../stage/store/content-store-write";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("/api/studio/inventory", () => {
  test("returns healthy entities and exact damage records", async () => {
    const root = await mkdtemp(join(tmpdir(), "bunzai-damaged-route-"));
    roots.push(root);
    const backend = memoryDocumentBackend();
    const content = createContentStore(backend);
    const handler = createHandler(new StudioStore(root, () => content), new SettingsStore(root), undefined, filledSec());

    expect(await (await handler(apiReq("/api/studio/inventory"))).json()).toEqual({
      entities: [],
      damaged: [],
    });

    const t = 0;
    const json = '{"schemaVersion":';
    await backend.write(
      { kind: "character", id: "broken", revision: "r1", version: 1, writeId: 1, autosaveStartedAt: null, createdAt: t, updatedAt: t },
      { kind: "character", id: "broken", version: 1, revision: "r1", savedAt: t, autosaveStartedAt: null, reason: "create" },
      { when: "absent" },
      null,
      { put: [buildPartText({ name: "h", json, blobs: [] })], drop: [] },
    );

    const response = await handler(apiReq("/api/studio/inventory?kind=character"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entities: [],
      damaged: [{ kind: "character", id: "broken", reason: "unreadable-json" }],
    });
  });

  test("is protected by the same API gate as the healthy list route", async () => {
    const root = await mkdtemp(join(tmpdir(), "bunzai-damaged-auth-"));
    roots.push(root);
    const handler = createHandler(new StudioStore(root), new SettingsStore(root), undefined, filledSec());
    const deniedList = await handler(apiReq("/api/studio/list", { host: "evil.example" }));
    const deniedInventory = await handler(apiReq("/api/studio/inventory", { host: "evil.example" }));

    expect(deniedList.status).toBe(403);
    expect(deniedInventory.status).toBe(403);
  });
});
