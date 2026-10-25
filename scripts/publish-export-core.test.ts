/** The export's private-path rule and its dangling-reference check. */
import { expect, test } from "bun:test";
import { danglingRefs, isPrivate, parsePrivateList } from "./publish-export-core";

const parsed = parsePrivateList("# comment\n\nspecs/\nplans/\ndocs/LESSONS.md\ndesign/system/BUILD-BRIEF.md\n~docs/llms.txt\n");
const entries = parsed.entries.filter((e) => !parsed.generated.includes(e));

test("the list drops comments and blanks and tells generated files apart", () => {
  expect(parsed.entries).toEqual(["specs/", "plans/", "docs/LESSONS.md", "design/system/BUILD-BRIEF.md", "docs/llms.txt"]);
  expect(parsed.generated).toEqual(["docs/llms.txt"]);
});

test("a folder entry covers what is inside it and nothing that only looks like it", () => {
  expect(isPrivate("specs/engine/macro-engine.md", entries)).toBe(true);
  expect(isPrivate("docs/LESSONS.md", entries)).toBe(true);
  expect(isPrivate("src/specs/x.ts", entries)).toBe(false);
  expect(isPrivate("docs/LESSONS.md.bak", entries)).toBe(false);
  expect(isPrivate("audit-plans/x.md", entries)).toBe(false);
  expect(isPrivate("docs/llms.txt", parsed.entries)).toBe(true);
});

const refs = (text: string, path = "docs/a.md") => danglingRefs([{ path, text }], entries).map((r) => r.ref);

test("links and prose that point at a private path are found with their line", () => {
  expect(refs("see [spec](../specs/formats/x.md)")).toEqual(["../specs/formats/x.md"]);
  expect(refs("per specs/engine/y.md stage 1")).toEqual(["specs/engine/y.md"]);
  expect(refs("a\nread LESSONS.md first")).toEqual(["LESSONS.md"]);
  expect(danglingRefs([{ path: "a.md", text: "a\nsee plans/x.md" }], entries)[0]?.line).toBe(2);
  expect(refs("see BUILD-BRIEF.md")).toEqual(["BUILD-BRIEF.md"]);
});

test("a generated file is left out but a mention of it is not dangling", () => {
  expect(refs("regenerated: docs/llms.txt")).toEqual([]);
});

test("a similar word is not a reference", () => {
  expect(refs("src/specs/x and audit-plans/y and the plans for lunch and MYLESSONS.md")).toEqual([]);
});
