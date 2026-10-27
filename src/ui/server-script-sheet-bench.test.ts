/**
 * A Script Sheet saved from the Workbench, through the real routes and the real store: the bench reads the piece light
 * (no escrow on the wire) and saves the patch it builds (`sheetPatch`), so an imported sheet keeps its escrowed source.
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import type { ScriptSheetBody } from "../entities/scriptsheet/schema";
import { sheetPatch } from "./apps/workbench/script-sheet-bench";
import { chatRouteRig as rig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);
setDefaultTimeout(30_000);

test("an imported sheet edited on the bench keeps its escrowed RoleCall file, and only what was edited changes", async () => {
  const { store, handler, post } = await rig();
  const ESCROW = { rolecall: { raw: { big: "x".repeat(40_000), script_sheet: { version: 1, content: "Be brief." } } } };
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "scriptsheet", id: "terse", body: { name: "Terse", content: "Be brief." }, original: ESCROW } as never);
  const light = (await (await handler(apiReq("/api/studio/get?kind=scriptsheet&id=terse&light=1"))).json()) as { entity: { body: ScriptSheetBody }; revision: string };
  expect(JSON.stringify(light.entity)).not.toContain("x".repeat(100)); // the escrow never crossed the wire

  const before = light.entity.body;
  const after: ScriptSheetBody = { ...before, name: "Terser", samplers: { temperature: 0.7 }, content: "Be briefer." };
  const saved = await post("/api/studio/patch", { kind: "scriptsheet", id: "terse", expectedRevision: light.revision, ...sheetPatch(light.entity, "terse", before, after) });
  expect(saved.status).toBe(200);

  const stored = (await store.read("scriptsheet", "terse")) as unknown as { body: ScriptSheetBody; original: { rolecall?: unknown } };
  expect(stored.original.rolecall).toEqual(ESCROW.rolecall);
  expect(stored.body.name).toBe("Terser");
  expect(stored.body.content).toBe("Be briefer.");
  expect(stored.body.samplers?.temperature).toBe(0.7);
});
