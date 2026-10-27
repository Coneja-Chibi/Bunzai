/** The scene preset writer's saves: one revision-checked write of the whole stored piece, and a conflict that keeps the caller's draft. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { ApiHttpError } from "../../_shared/api-fetch";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { PresetText } from "./use-scene-preset-text";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

// a piece as the library holds it: the write must carry everything but the body through unchanged
const stored = { schemaVersion: "1", original: { format: "rolecall-script-sheet", raw: {} }, notes: "mine" };
const sheet = { ...stored, kind: "scriptsheet", id: "terse", body: { name: "Terse", content: "Be brief." } };
const preset = { ...stored, kind: "preset", id: "plain", body: { name: "Plain", prompts: [{ id: "main", name: "Main", role: "system", content: "Old.", enabled: true }] } };

async function writer(saveEditedEntity: (entity: unknown, revision: string) => Promise<{ revision: string }>, piece: { kind: string; id: string } = sheet) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useScenePresetText } = await import("./use-scene-preset-text");
  const ctx = { api: { getEditableEntity: async () => ({ entity: piece, revision: "r1" }), saveEditedEntity } } as unknown as AppContext;
  const out: { text?: PresetText } = {};
  const Probe = () => { out.text = useScenePresetText(ctx, { kind: piece.kind, id: piece.id }, () => undefined); return null; };
  let root!: Root;
  await act(async () => { root = createRoot(document.createElement("div")); root.render(<Probe />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { text: () => out.text!, act, unmount: () => act(async () => root.unmount()) };
}

test("a sheet save writes the name and instruction against the loaded revision", async () => {
  const writes: { entity: unknown; revision: string }[] = [];
  const w = await writer(async (entity, revision) => { writes.push({ entity, revision }); return { revision: "r2" }; });
  await w.act(async () => { await w.text().saveSheet("Terser", "Be briefer."); });
  expect(writes).toEqual([{ entity: { ...sheet, body: { name: "Terser", content: "Be briefer." } }, revision: "r1" }]);
  const loaded = w.text().loaded;
  expect(loaded.state === "ready" && loaded.revision).toBe("r2");
  // the rest of the scene reads the sheet as the preset it sends
  expect(loaded.state === "ready" && loaded.entity.body.prompts[0]?.content).toBe("Be briefer.");
  await w.unmount();
});

test("a conflict rejects in words and leaves the saved sheet as it was", async () => {
  const w = await writer(async () => { throw new ApiHttpError(409, "conflict"); });
  let why = "";
  await w.act(async () => { await w.text().saveSheet("Terser", "Be briefer.").catch((e: Error) => { why = e.message; }); });
  expect(why).toContain("changed somewhere else first");
  const loaded = w.text().loaded;
  expect(loaded.state === "ready" && (loaded.raw as typeof sheet).body.content).toBe("Be brief.");
  await w.unmount();
});

test("a preset block edit writes the whole stored preset with only that block changed", async () => {
  const writes: { entity: unknown; revision: string }[] = [];
  const w = await writer(async (entity, revision) => { writes.push({ entity, revision }); return { revision: "r2" }; }, preset);
  await w.act(async () => { w.text().saveText("main", "New.", w.text().reloads); await new Promise((r) => setTimeout(r, 0)); });
  expect(writes).toEqual([{ entity: { ...preset, body: { ...preset.body, prompts: [{ ...preset.body.prompts[0]!, content: "New." }] } }, revision: "r1" }]);
  expect(w.text().note?.kind).toBe("saved");
  await w.unmount();
});

test("a save queued before the sheet reloads is refused, never written into what loaded since", async () => {
  const writes: unknown[] = [];
  let release!: () => void;
  const first = new Promise<void>((r) => { release = r; });
  let calls = 0;
  const w = await writer(async (entity) => { writes.push(entity); if (++calls === 1) await first; return { revision: `r${calls + 1}` }; });
  let firstSave!: Promise<void>;
  let queued!: Promise<void>;
  let why = "";
  await w.act(async () => {
    firstSave = w.text().saveSheet("A", "First.");
    queued = w.text().saveSheet("B", "Second.").catch((e: Error) => { why = e.message; });
    await new Promise((r) => setTimeout(r, 0)); // the first save is now writing
    await w.text().load({ kind: "scriptsheet", id: "terse" });
    release();
    await firstSave.catch(() => undefined);
    await queued;
  });
  expect(why).toContain("reloaded before this save ran");
  expect(writes).toHaveLength(1);
  await w.unmount();
});
