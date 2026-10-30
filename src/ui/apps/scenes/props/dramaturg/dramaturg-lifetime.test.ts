/** Public Dramaturg projections discard locked plaintext, stale reads and old visited scenes. */
import { afterEach, expect, test } from "bun:test";
import { lockAll } from "../../../../_shared/caches";
import type { DramaturgPanel } from "../../../../app-contract-dramaturg";
import { askDramaturg, dramaturgState, loadDramaturg, resetDramaturgLive, saveDramaturgSettings } from "./dramaturg-live";
import type { DramaturgStreamEvent } from "../../../../app-contract-dramaturg";

afterEach(resetDramaturgLive);
const panel = (revision = 1): DramaturgPanel => ({ on: true, busy: false, tools: "none", model: null, thread: { revision, settings: {}, entries: [{ id: "one", role: "user", text: "PRIVATE PLAINTEXT", at: 1 }] } });
const api = (getSceneDramaturg: () => Promise<DramaturgPanel>): Parameters<typeof loadDramaturg>[0] => ({
  getSceneDramaturg, askSceneDramaturg: async () => undefined, stopSceneDramaturg: async () => undefined,
  clearSceneDramaturg: async () => panel(), setSceneDramaturgSettings: async () => panel(),
});

test("locking clears loaded plaintext and fences a pending load", async () => {
  await loadDramaturg(api(async () => panel()), "loaded");
  let finish!: (value: DramaturgPanel) => void;
  const pending = loadDramaturg(api(() => new Promise((resolve) => { finish = resolve; })), "pending");
  lockAll();
  finish(panel());
  await pending;
  expect(dramaturgState("loaded").panel).toBeNull();
  expect(dramaturgState("pending").panel).toBeNull();
});

test("an older overlapping read cannot roll the panel back", async () => {
  let finish!: (value: DramaturgPanel) => void;
  const old = loadDramaturg(api(() => new Promise((resolve) => { finish = resolve; })), "scene");
  await loadDramaturg(api(async () => panel(2)), "scene");
  finish(panel(1));
  await old;
  expect(dramaturgState("scene").panel?.thread.revision).toBe(2);
});

test("visiting further scenes evicts old retained conversations", async () => {
  for (let i = 0; i < 5; i++) await loadDramaturg(api(async () => panel()), `scene${i}`);
  expect(dramaturgState("scene0").panel).toBeNull();
  expect(dramaturgState("scene4").panel).not.toBeNull();
});

test("the byte ceiling includes model metadata and aggregate full conversations", async () => {
  const huge = { ...panel(), model: { id: "model", model: "m".repeat(17 * 1024 * 1024) } };
  await loadDramaturg(api(async () => huge), "huge");
  expect(dramaturgState("huge").panel).toBeNull();
  const full = panel();
  full.thread.entries = Array.from({ length: 200 }, (_, i) => ({ id: String(i), role: "user", text: "x".repeat(40_000), at: 1 }));
  for (let i = 0; i < 3; i++) await loadDramaturg(api(async () => full), `full${i}`);
  expect(dramaturgState("full0").panel).toBeNull();
  expect(dramaturgState("full2").panel).not.toBeNull();
});

test("lock aborts a stream and late callbacks cannot restore its plaintext", async () => {
  let emit!: (event: DramaturgStreamEvent) => void, finish!: () => void, signal!: AbortSignal;
  const source = { ...api(async () => panel()), askSceneDramaturg: async (_id: string, _question: string, _revision: number, onEvent: typeof emit, outer?: AbortSignal) => {
    emit = onEvent; signal = outer!;
    await new Promise<void>((resolve) => { finish = resolve; });
  } };
  await loadDramaturg(source, "scene");
  const pending = askDramaturg(source, "scene", "Why?");
  emit({ type: "text", delta: "private preview" });
  lockAll();
  expect(signal.aborted).toBe(true);
  emit({ type: "done", thread: panel().thread }); finish();
  await pending;
  expect(dramaturgState("scene").panel).toBeNull();
  expect(dramaturgState("scene").pending).toBeNull();
});

test("settings responses re-read committed state instead of installing a delayed settings snapshot", async () => {
  let finish!: (value: DramaturgPanel) => void;
  const source = { ...api(async () => panel(2)), setSceneDramaturgSettings: () => new Promise<DramaturgPanel>((resolve) => { finish = resolve; }) };
  await loadDramaturg(source, "scene");
  const saving = saveDramaturgSettings(source, "scene", { temperature: 1 });
  finish(panel(1)); await saving;
  expect(dramaturgState("scene").panel?.thread.revision).toBe(2);
});
