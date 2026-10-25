/**
 * The Write-for contract every per-entity capabilities module must meet (lore, regex, persona,
 * preset): labelled profiles led by "full", a tolerant parser, core keys on every profile, the full
 * union showing everything, each profile showing its own extras, and visibility that is exactly
 * ownership. Run by each entity's test file against its own data, so the rule is asserted once.
 */
import { describe, expect, test } from "bun:test";

export interface WriteForSpec<P extends string, K extends string> {
  name: string;
  profiles: readonly P[];
  labels: Readonly<Record<P, string>>;
  parse: (value: unknown) => P;
  coreKeys: readonly K[];
  allKeys: () => readonly K[];
  extras: Readonly<Partial<Record<P, readonly K[]>>>;
  owns: (profile: P, key: K) => boolean;
  visible: (profile: P, key: K) => boolean;
}

export function writeForContract<P extends string, K extends string>(spec: WriteForSpec<P, K>): void {
  describe(`${spec.name} Write-for contract`, () => {
    test("every profile has a label, full leads, and the parser keeps profiles and falls back to full", () => {
      expect(spec.profiles[0] as string).toBe("full");
      for (const p of spec.profiles) {
        expect(spec.labels[p].length).toBeGreaterThan(0);
        expect(spec.parse(p) as string).toBe(p);
      }
      for (const bad of ["nonsense", 42, null, undefined]) expect(spec.parse(bad) as string).toBe("full");
    });

    test("core keys are owned and shown on every profile", () => {
      for (const p of spec.profiles) {
        for (const k of spec.coreKeys) {
          expect(spec.owns(p, k)).toBe(true);
          expect(spec.visible(p, k)).toBe(true);
        }
      }
    });

    test("full is the union: it owns and shows every key", () => {
      for (const k of spec.allKeys()) {
        expect(spec.owns("full" as P, k)).toBe(true);
        expect(spec.visible("full" as P, k)).toBe(true);
      }
    });

    test("every extra a profile lists is owned and shown on that profile", () => {
      for (const p of spec.profiles) {
        for (const k of spec.extras[p] ?? []) {
          expect(spec.owns(p, k)).toBe(true);
          expect(spec.visible(p, k)).toBe(true);
        }
      }
    });

    test("a field is hidden exactly when the profile does not own it", () => {
      for (const p of spec.profiles) {
        for (const k of spec.allKeys()) expect(spec.visible(p, k)).toBe(spec.owns(p, k));
      }
    });
  });
}
