/** loadReasoning: the scene reads its writing setup's reasoning markers itself, and a bad read means the built-in tags. */
import { expect, test } from "bun:test";
import { loadReasoning } from "./scene-reasoning";

const api = (getEntity: (q: string) => Promise<unknown>) => ({ getEntity }) as never;
const preset = (body: unknown) => async () => ({ kind: "preset", id: "p", body });

test("returns the preset's markers", async () => {
  const got = await loadReasoning(api(async (q) => {
    expect(q).toBe("kind=preset&id=p%201");
    return { kind: "preset", id: "p 1", body: { reasoning: { prefix: "<t>", suffix: "</t>", separator: "\n" } } };
  }), { kind: "preset", id: "p 1" });
  expect(got).toEqual({ prefix: "<t>", suffix: "</t>", separator: "\n" });
});

test("a Script Sheet is read as its own kind and has no markers", async () => {
  const got = await loadReasoning(api(async (q) => {
    expect(q).toBe("kind=scriptsheet&id=s");
    return { kind: "scriptsheet", id: "s", body: { name: "Terse", content: "Be brief." } };
  }), { kind: "scriptsheet", id: "s" });
  expect(got).toBeUndefined();
});

test("a preset without markers, a malformed one, and a failed read all mean none", async () => {
  const p = { kind: "preset", id: "p" };
  expect(await loadReasoning(api(preset({})), p)).toBeUndefined();
  expect(await loadReasoning(api(preset({ reasoning: { prefix: 1 } })), p)).toBeUndefined();
  expect(await loadReasoning(api(async () => { throw new Error("down"); }), p)).toBeUndefined();
});
