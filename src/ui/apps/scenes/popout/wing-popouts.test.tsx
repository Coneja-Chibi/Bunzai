/** The wing-body kinds stay in step with the Messenger's programs (messenger/programs.ts) and with the pop-out id contract. */
import { describe, expect, test } from "bun:test";
import type { AppContext } from "../../../app-contract";
import type { OpenScene } from "../../../../studio/scenes";
import { buildPrograms } from "../messenger/programs";
import { WING_BODY_SPECS, wingBodyPopouts } from "./wing-popouts";

describe("wing body pop-out kinds", () => {
  test("every kind is a program with the same title and icon, ids are valid and unique", () => {
    const programs = new Map(buildPrograms({} as OpenScene, [], [], { get: () => undefined } as unknown as AppContext["prefs"]).map((p) => [p.id, p]));
    const kinds = wingBodyPopouts(() => <></>);
    expect(kinds).toHaveLength(WING_BODY_SPECS.length);
    expect(new Set(kinds.map((k) => k.id)).size).toBe(kinds.length);
    for (const [i, k] of kinds.entries()) {
      const program = programs.get(WING_BODY_SPECS[i]!.program);
      expect(program).toBeDefined();
      expect(k.title).toBe(program!.title);
      expect(k.icon).toBe(program!.icon);
      expect(k.id).toMatch(/^[a-z0-9.-]{1,64}$/);
    }
  });
});
