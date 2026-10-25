/**
 * A locked library answers 423 from every route, so the
 * shell can show the stage door: routes that map their own errors (the export) included, which the
 * review found turning a locked library into a 500.
 */
import { beforeAll, expect, test } from "bun:test";
import { loadFormats } from "../core";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { StudioLockedError } from "../studio/errors";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

beforeAll(async () => {
  await loadFormats();
});

/** A store over a locked library: every method refuses, as the library's storage does. */
const locked = <T extends object>(): T =>
  new Proxy({} as T, {
    // Not a thenable, and the folder's path stays a plain answer: the lock guards contents, not where they live.
    get: (_, name) =>
      name === "then" ? undefined : name === "studioPath" ? () => "/locked-studio" : async () => {
      throw new StudioLockedError();
    },
  });

test("while the library is locked, listing, exporting, and saving an import all answer 423", async () => {
  const security = filledSec();
  const handler = createHandler(locked<StudioStoreLike>(), locked<SettingsStoreLike>(), undefined, security);

  expect((await handler(apiReq("/api/studio/list"))).status).toBe(423);

  // A card that links a lorebook: exporting it reads the library, which is locked.
  const entity = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "vera",
    body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: ["harbor-lore"] },
  };
  const exported = await handler(
    apiReq("/api/export", {
      method: "POST",
      token: security.token,
      contentType: "application/json",
      body: JSON.stringify({ entity, targetId: "sillytavern" }),
    }),
  );
  expect(exported.status).toBe(423);

  // Saving an import reports its own failures as a result (partial saves are named), so the lock
  // has to get past that too while nothing has been saved. save-staged shares this path.
  const saved = await handler(
    apiReq("/api/studio/save-bundle", {
      method: "POST",
      token: security.token,
      contentType: "application/json",
      body: JSON.stringify({ entity }),
    }),
  );
  expect(saved.status).toBe(423);
});
