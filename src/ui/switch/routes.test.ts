/** Request-boundary contract for the host-only update switch routes. */
import { describe, expect, test } from "bun:test";
import { handleUpdatesRoutes } from "./routes";
import type { StudioSettings } from "../../studio/settings-shape";

const emptySettings = { setupComplete: false } as StudioSettings;
const settings = {
  read: async () => emptySettings,
  save: async () => emptySettings,
  update: async () => emptySettings,
};

const deps = {
  manager: { start: () => true, status: () => ({ phase: "idle" as const, message: "", target: null }) },
  settings,
  installed: "v1.0.0",
};

const post = (body: string, contentType = "application/json"): Request => new Request("http://127.0.0.1/api/updates/switch", {
  method: "POST",
  headers: { "content-type": contentType },
  body,
});

describe("update switch request boundary", () => {
  test("rejects a JSON object without an application/json content type", async () => {
    const response = await handleUpdatesRoutes(post('{"version":"v1.0.1"}', "text/plain"), "/api/updates/switch", deps);
    expect(response?.status).toBe(415);
  });

  test("rejects valid JSON that is not an object", async () => {
    const response = await handleUpdatesRoutes(post("[]"), "/api/updates/switch", deps);
    expect(response?.status).toBe(400);
  });

  test("preserves the release-tag validation for a nonempty version", async () => {
    const response = await handleUpdatesRoutes(post('{"version":"latest"}'), "/api/updates/switch", deps);
    expect(response?.status).toBe(400);
    expect(await response?.text()).toContain("release tag");
  });
});
