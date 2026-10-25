/** loadReasoning: the scene reads the preset's reasoning markers itself, and a bad read means the built-in tags. */
import { expect, test } from "bun:test";
import { loadReasoning } from "./scene-reasoning";

const api = (getEntity: (q: string) => Promise<unknown>) => ({ getEntity }) as never;

test("returns the preset's markers", async () => {
  const got = await loadReasoning(api(async (q) => {
    expect(q).toBe("kind=preset&id=p%201");
    return { body: { reasoning: { prefix: "<t>", suffix: "</t>", separator: "\n" } } };
  }), "p 1");
  expect(got).toEqual({ prefix: "<t>", suffix: "</t>", separator: "\n" });
});

test("a preset without markers, a malformed one, and a failed read all mean none", async () => {
  expect(await loadReasoning(api(async () => ({ body: {} })), "p")).toBeUndefined();
  expect(await loadReasoning(api(async () => ({ body: { reasoning: { prefix: 1 } } })), "p")).toBeUndefined();
  expect(await loadReasoning(api(async () => { throw new Error("down"); }), "p")).toBeUndefined();
});
