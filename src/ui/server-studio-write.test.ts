/** HTTP-boundary regression tests for Studio save validation and persistence isolation. */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { bytesToBase64 } from "../core/base64";
import { hashHex } from "../core/sha256";
import { entityRevision } from "../entities/canonical-revision";
import { parseCanonicalEntity } from "../entities/runtime-schema";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("/api/studio/save", () => {
  test("a full editor load with hydrated art carries the stored revision and can save", async () => {
    const root = await mkdtemp(join(tmpdir(), "bunzai-studio-write-"));
    roots.push(root);
    const content = createContentStore(memoryDocumentBackend());
    const store = new StudioStore(root, () => content);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    const piece = {
      schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "pictured",
      body: {
        identity: { name: "Pictured" }, persona: {}, prompts: {}, greetings: {}, examples: {},
        media: {},
        attribution: {}, discovery: {},
      },
    };
    const saved = await store.save(piece);
    const bytes = new Uint8Array(2048).map((_, i) => (i * 7 + 3) % 251);
    const key = hashHex(bytes);
    const withArt = await store.comparePatch("character", "pictured", saved.revision!, {
      head: { ...piece, body: { ...piece.body, media: { portrait: {
        role: "portrait", primary: true, mime: "image/png", ref: `\u0000b:u:image/png:${key}`,
      } } } },
    }, [{ key, payload: { kind: "bytes", bytes } }]);
    if (withArt.status !== "saved") throw new Error(`fixture art: ${withArt.status}`);
    const response = await handler(apiReq("/api/studio/get?kind=character&id=pictured&revision=1", { token: security.token }));
    expect(response.status).toBe(200);
    const opened = await response.json();
    expect(opened.entity.body.media.portrait.ref).toBe(`data:image/png;base64,${bytesToBase64(bytes)}`);
    expect(opened.revision).toBe(withArt.revision);

    const head = parseCanonicalEntity((await store.readLight("character", "pictured"))!.entity);
    const patched = await handler(apiReq("/api/studio/patch", {
      method: "POST", token: security.token, contentType: "application/json",
      body: JSON.stringify({ kind: "character", id: "pictured", expectedRevision: opened.revision,
        head: { ...head, body: { ...head.body as object, identity: { name: "Saved picture" } } }, intent: "manual" }),
    }));
    expect(patched.status).toBe(200);
    expect((await store.summary("character", "pictured"))?.name).toBe("Saved picture");
    expect((await store.summary("character", "pictured"))?.hasPortrait).toBe(true);
  });

  test("returns the complete entity with its revision for an editor load", async () => {
    const root = await mkdtemp(join(tmpdir(), "bunzai-studio-write-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    await store.save({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: "editable",
      body: { name: "Editable", content: "" },
    });
    const entity = (await store.read("persona", "editable"))!;

    const response = await handler(apiReq(
      "/api/studio/get?kind=persona&id=editable&revision=1",
      { token: security.token },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entity,
      revision: entityRevision(entity),
    });
  });

  test("returns a bounded 400 and writes nothing for malformed optional canonical data", async () => {
    const root = await mkdtemp(join(tmpdir(), "bunzai-studio-write-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    const request = apiReq("/api/studio/save", {
      method: "POST",
      token: security.token,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "character",
        id: "bad-settings",
        body: {
          identity: { name: "Bad settings" },
          persona: {},
          prompts: {},
          greetings: {},
          examples: {},
          media: {},
          attribution: {},
          discovery: {},
          settings: "not an object",
        },
      }),
    });

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid canonical entity" });
    expect(await store.read("character", "bad-settings")).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  test("rejects a stale editor revision without overwriting the newer entity", async () => {
    const root = await mkdtemp(join(tmpdir(), "bunzai-studio-write-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    const baseline = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: "stale-editor",
      body: { name: "Baseline", content: "" },
    };
    await store.save(baseline);
    const opened = (await store.read("persona", baseline.id))!;
    await store.save(
      { ...opened, body: { name: "Newer disk state", content: "" } },
      { overwrite: true },
    );

    const response = await handler(apiReq("/api/studio/save", {
      method: "POST",
      token: security.token,
      contentType: "application/json",
      body: JSON.stringify({
        entity: { ...opened, body: { name: "Stale tab", content: "" } },
        expectedRevision: entityRevision(opened),
      }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "piece changed since it was opened" });
    expect((await store.read("persona", baseline.id))?.body).toEqual({
      name: "Newer disk state",
      content: "",
    });
  });
});
