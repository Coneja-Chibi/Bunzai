/** The tracker reader a scene's turn is given: the library's piece through the tracker kind's strict decoder, and nothing for what it cannot trust. */
import { describe, expect, test } from "bun:test";
import type { TrackerBody } from "../entities/tracker/schema";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import { promptBudgetOf, toolBudgetOf, trackerReaderOf } from "./server-scene-readers";

const body: TrackerBody = { name: "Health", description: "", layout: "record", note: "", fields: [{ name: "hp", description: "", type: "number", default: 100 }] };
const entity = (kind: string, b: unknown) => ({ schemaVersion: "1", kind, id: "h", body: b });
const studio = (pieces: Record<string, unknown>): StudioStoreLike => ({ read: async (kind: string, id: string) => pieces[`${kind}:${id}`] ?? null }) as unknown as StudioStoreLike;

describe("trackerReaderOf", () => {
  test("a valid tracker piece reads as its body", async () => {
    expect(await trackerReaderOf(studio({ "tracker:h": entity("tracker", body) }))!("h")).toEqual(body);
  });

  test("a missing piece, another kind, a body the decoder refuses and a store that throws all read as nothing", async () => {
    const read = trackerReaderOf(studio({
      "tracker:other": entity("tool", body),
      "tracker:bad": entity("tracker", { ...body, layout: "grid" }),
      "tracker:extra": entity("tracker", { ...body, extra: 1 }),
    }))!;
    for (const id of ["missing", "other", "bad", "extra"]) expect(await read(id)).toBeNull();
    const broken = trackerReaderOf({ read: async () => { throw new Error("locked"); } } as unknown as StudioStoreLike)!;
    expect(await broken("h")).toBeNull();
  });

  test("without a library there is no reader", () => {
    expect(trackerReaderOf(undefined)).toBeUndefined();
  });
});

describe("toolBudgetOf (the setting scenes.toolBudgetMs, no screen yet)", () => {
  const settings = (value: unknown) => ({ read: async () => ({ setupComplete: true, "scenes.toolBudgetMs": value }) }) as unknown as SettingsStoreLike;
  test("a positive finite number is the budget; anything else, or no settings, is no setting", async () => {
    expect(await toolBudgetOf(settings(2_500))!()).toBe(2_500);
    for (const bad of [0, -5, "9", null, Number.NaN, Number.POSITIVE_INFINITY, undefined]) expect(await toolBudgetOf(settings(bad))!(), String(bad)).toBeUndefined();
    expect(toolBudgetOf(undefined)).toBeUndefined();
  });
});

describe("promptBudgetOf (the setting scenes.promptBudgetMs, no screen yet)", () => {
  const settings = (value: unknown) => ({ read: async () => ({ setupComplete: true, "scenes.promptBudgetMs": value }) }) as unknown as SettingsStoreLike;
  test("a positive finite number is the budget; anything else, or no settings, is no setting", async () => {
    expect(await promptBudgetOf(settings(1_500))!()).toBe(1_500);
    for (const bad of [0, -1, "9", null, Number.NaN, undefined]) expect(await promptBudgetOf(settings(bad))!(), String(bad)).toBeUndefined();
    expect(promptBudgetOf(undefined)).toBeUndefined();
  });
});
