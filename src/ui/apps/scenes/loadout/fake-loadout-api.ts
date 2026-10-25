/**
 * A stand-in for the part of the scenes api the loadout engine uses (tests only): the scene's settings in memory,
 * every call logged in order, receipts timed by a clock the test owns, and a way to make any one call fail.
 */
import { UNDO_MS, type LoadoutUnit } from "../../../../core/loadout-panels";
import type { LoadoutReceipt } from "../../../../studio/loadout-record";
import type { SceneSettings } from "../../../app-contract-scenes";
import type { LoadoutApi } from "./loadout-units";

export interface FakeLoadoutApi {
  api: LoadoutApi;
  scene: SceneSettings;
  /** Every call in order: a unit name for a setter, or "receipt-save", "receipt-finish", "receipt-undone". */
  calls: string[];
  receipts: Map<string, LoadoutReceipt>;
  /** Names of calls that throw when made. */
  failing: Set<string>;
  clock: { now: number };
}

export function fakeLoadoutApi(scene: SceneSettings = { persona: null }): FakeLoadoutApi {
  const fake: FakeLoadoutApi = { scene, calls: [], receipts: new Map(), failing: new Set(), clock: { now: 1_000_000 }, api: undefined as never };
  const call = (name: string) => {
    fake.calls.push(name);
    if (fake.failing.has(name)) throw new Error(`${name} refused`);
  };
  const set = <K extends keyof SceneSettings>(unit: LoadoutUnit, key: K, value: SceneSettings[K] | null) => {
    call(unit);
    if (value === null || value === undefined) delete fake.scene[key];
    else fake.scene[key] = value;
    return Promise.resolve({ unit } as never);
  };
  fake.api = {
    sceneSettings: async () => structuredClone(fake.scene),
    setSceneConnection: (_c, v) => set("connection", "connection", v),
    setScenePreset: (_c, v) => set("preset", "preset", v),
    setSceneLore: (_c, v) => set("lore", "lore", v),
    setSceneProps: (_c, on) => set("props", "props", { on }),
    setScenePrompting: (_c, patch) => {
      const unit: LoadoutUnit = "guides" in patch ? "guides" : "note";
      call(unit);
      const next = { ...fake.scene.prompting };
      if ("guides" in patch) patch.guides ? (next.guides = patch.guides) : delete next.guides;
      if ("note" in patch) patch.note ? (next.note = patch.note) : delete next.note;
      if (next.guides || next.note) fake.scene.prompting = next;
      else delete fake.scene.prompting;
      return Promise.resolve({ unit } as never);
    },
    setSceneRegex: (_c, patch) => set("regex", "regex", patch.sets ? { sets: patch.sets } : null),
    setSceneFinalCut: (_c, patch) => set("finalCut", "finalCut", patch.on === null && patch.passes === null && patch.tools === null ? null : { ...(patch.on ? { on: true as const } : {}), ...(patch.passes ? { passes: patch.passes } : {}), ...(patch.tools ? { tools: patch.tools } : {}) }),
    setSceneBackdrop: (_c, v) => set("backdrop", "backdrop", v),
    editScene: (_action, input) => {
      call("persona");
      fake.scene.persona = input["personaId"] as string | null;
      return Promise.resolve({ unit: "persona" } as never);
    },
    saveLoadoutReceipt: async (r) => {
      call("receipt-save");
      const saved = { ...r, appliedAt: fake.clock.now, undoUntil: fake.clock.now + UNDO_MS };
      fake.receipts.set(saved.code, saved);
      return saved;
    },
    finishLoadoutReceipt: async (code, rows) => {
      call("receipt-finish");
      const next = { ...fake.receipts.get(code)!, rows };
      fake.receipts.set(code, next);
      return next;
    },
    markLoadoutReceiptUndone: async (code) => {
      call("receipt-undone");
      const next = { ...fake.receipts.get(code)!, undoneAt: fake.clock.now };
      fake.receipts.set(code, next);
      return next;
    },
  };
  return fake;
}
