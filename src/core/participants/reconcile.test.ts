/** RECONCILE RECENT SCENE's pure half: the answer is read once, malformed output proposes nothing, and RoleCall's refusal and duplicate rules hold. */
import { describe, expect, test } from "bun:test";
import { chunkMessages, parseReconcile, propose, refuseCandidate, reconcileMessages, repairReconcile, sameActor } from "./reconcile";

describe("parseReconcile", () => {
  test("reads the object bare or fenced, with a null description", () => {
    expect(parseReconcile('{"participants":[{"display_name":" Mira Vance ","description":null}]}')).toEqual({ ok: true, value: [{ name: "Mira Vance", description: null }] });
    expect(parseReconcile('```json\n{"participants":[]}\n```')).toEqual({ ok: true, value: [] });
  });
  test("malformed output is a reason, never an empty success", () => {
    for (const bad of ["no json", '{"people":[]}', '{"participants":"x"}', '{"participants":[1]}', '{"participants":[{"description":"x"}]}']) {
      expect(parseReconcile(bad).ok).toBe(false);
    }
  });
  test("at most eight per answer", () => {
    const many = JSON.stringify({ participants: Array.from({ length: 12 }, (_, i) => ({ display_name: `P${i}`, description: null })) });
    expect((parseReconcile(many) as { value: unknown[] }).value).toHaveLength(8);
  });
});

describe("refuseCandidate", () => {
  test("RoleCall's rules", () => {
    expect(refuseCandidate({ name: "Mira Vance", description: null })).toBeNull();
    expect(refuseCandidate({ name: "Update the timeline", description: null })).toMatch(/action/);
    expect(refuseCandidate({ name: "Throne Room", description: "a hall" })).toMatch(/place/);
    expect(refuseCandidate({ name: "Throne Room", description: "she rules there" })).toBeNull();
    expect(refuseCandidate({ name: "A & B", description: null })).toMatch(/multiple/);
    expect(refuseCandidate({ name: "Lore: Origins", description: null })).toMatch(/lore/);
    expect(refuseCandidate({ name: "x".repeat(81), description: null })).toMatch(/long/);
  });
});

describe("propose", () => {
  test("drops refused names, names on the roster (retired included, by RoleCall's ladder) and repeats, and counts them", () => {
    const p = propose([[{ name: "Atlas Guard", description: null }, { name: "Mira Vance", description: "she speaks" }], [{ name: "mira vance", description: null }, { name: "Update plot", description: null }, { name: "Sol", description: null }]], ["ATLAS Guard (npc)"]);
    expect(p.candidates.map((c) => c.name)).toEqual(["Mira Vance", "Sol"]);
    expect([p.known, p.rejected]).toEqual([2, 1]);
  });
  test("sameActor: subsets and near typos match, different people do not", () => {
    expect(sameActor("Mira", "Mira Vance")).toBe(true);
    expect(sameActor("Alexandria Stone", "Alexandria Stome")).toBe(true);
    expect(sameActor("Mira Vance", "Sol Vance")).toBe(false);
  });
});

describe("prompts and chunks", () => {
  test("the prompt carries the roster and the repair carries the refused answer", () => {
    const m = reconcileMessages("text", [{ name: "Vera", kind: "card" }]);
    expect(m.system).toContain("- Vera (card)");
    expect(repairReconcile(m, "oops", "why").user).toContain("oops");
  });
  test("chunks stay within the cap and keep every message", () => {
    const msgs = ["a".repeat(70), "b".repeat(70), "c".repeat(300)];
    const chunks = chunkMessages(msgs, 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join("").replace(/\n/g, "").length).toBe(440);
  });
});
