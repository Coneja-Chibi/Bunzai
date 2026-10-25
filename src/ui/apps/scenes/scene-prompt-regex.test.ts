/** The page's half of a scene's prompt regex: it runs the turn's rules in the sandbox worker and answers with the changed texts, or with why it could not. */
import { expect, test } from "bun:test";
import { answerRegexRequest } from "../../../sandbox/regex/request";
import type { RegexRule } from "../../../entities/regex/schema";
import { answerPromptRegex } from "./scene-prompt-regex";

const rule = (id: string, over: Partial<RegexRule> = {}): RegexRule => ({ id, label: id, find: "cat", flags: "g", replace: "dog", phases: ["prompt"], enabled: true, sortOrder: 0, ...over });
const workerLike = (): Worker => {
  let listener: ((e: { data: unknown }) => void) | undefined;
  return {
    addEventListener: (t: string, fn: (e: { data: unknown }) => void) => { if (t === "message") listener = fn; },
    removeEventListener: () => undefined,
    postMessage: (data: unknown) => queueMicrotask(() => listener?.({ data: answerRegexRequest(data) })),
    terminate: () => undefined,
  } as unknown as Worker;
};
const event = (rules: RegexRule[], items: { index: number; role: "user" | "assistant"; depth: number; text: string }[]) => ({ type: "regex" as const, turnId: "t1", rules, items, macros: { user: "Ann", char: "Vera" } });

test("it answers with only the messages the rules changed, each rule at the depth of its message", async () => {
  const answers: unknown[] = [];
  await answerPromptRegex(event([rule("a", { maxDepth: 0 })], [{ index: 1, role: "assistant", depth: 1, text: "cat" }, { index: 2, role: "user", depth: 0, text: "cat" }, { index: 3, role: "user", depth: 0, text: "bird" }]),
    async (a) => { answers.push(a); }, workerLike);
  expect(answers).toEqual([{ kind: "done", texts: { 2: "dog" } }]);
});

test("a rule that names roles (RoleCall's message_roles) runs only for them", async () => {
  const answers: unknown[] = [];
  await answerPromptRegex(event([rule("u", { extras: { message_roles: ["user"] } })], [{ index: 1, role: "assistant", depth: 1, text: "cat" }, { index: 2, role: "user", depth: 0, text: "cat" }]),
    async (a) => { answers.push(a); }, workerLike);
  expect(answers).toEqual([{ kind: "done", texts: { 2: "dog" } }]);
});

test("more messages than one batch are all answered", async () => {
  const answers: { kind: string; texts: Record<number, string> }[] = [];
  const items = Array.from({ length: 250 }, (_, i) => ({ index: i, role: "user" as const, depth: i, text: "cat" }));
  await answerPromptRegex(event([rule("a")], items), async (a) => { answers.push(a as never); }, workerLike);
  expect(Object.keys(answers[0]!.texts)).toHaveLength(250);
});

test("a worker that cannot start is told to the turn as a failure, never as an empty success", async () => {
  const answers: unknown[] = [];
  await answerPromptRegex(event([rule("a")], [{ index: 1, role: "user", depth: 0, text: "cat" }]), async (a) => { answers.push(a); }, () => { throw new Error("blocked by policy"); });
  expect(answers).toEqual([{ kind: "failed", error: expect.stringContaining("blocked by policy") }]);
});

test("a refused answer is not retried into silence: the failure to answer is itself swallowed once", async () => {
  await expect(answerPromptRegex(event([rule("a")], [{ index: 1, role: "user", depth: 0, text: "cat" }]), async () => { throw new Error("offline"); }, workerLike)).resolves.toBeUndefined();
});

test("{{user}} and {{char}} in a find pattern (a rule that substitutes macros) are filled in from the turn's names before the rule runs", async () => {
  const answers: unknown[] = [];
  await answerPromptRegex(event([rule("a", { find: "{{char}} to {{user}}", substituteFind: "raw", replace: "greeting" })], [{ index: 1, role: "user", depth: 0, text: "Vera to Ann: hi" }]), async (a) => { answers.push(a); }, workerLike);
  expect(answers).toEqual([{ kind: "done", texts: { 1: "greeting: hi" } }]);
});

test("when a replacement carries a macro the braces of captured text are hidden, so the turn expands only what the rule's author wrote", async () => {
  const answers: unknown[] = [];
  await answerPromptRegex(event([rule("a", { find: "(.+)", replace: "{{user}} saw $1" })], [{ index: 1, role: "user", depth: 0, text: "{{evil}}" }]), async (a) => { answers.push(a); }, workerLike);
  expect(answers).toEqual([{ kind: "done", texts: { 1: "{{user}} saw \x01\x01evil\x02\x02" } }]);
});

test("Final Cut's input (phase display) runs the scene's display rules as written, with no role filter", async () => {
  const answers: unknown[] = [];
  await answerPromptRegex({ ...event([rule("d", { phases: ["display"], extras: { message_roles: ["user"] } })], [{ index: 0, role: "assistant", depth: 0, text: "cat" }]), phase: "display" }, async (a) => { answers.push(a); }, workerLike);
  expect(answers).toEqual([{ kind: "done", texts: { 0: "dog" } }]);
});
