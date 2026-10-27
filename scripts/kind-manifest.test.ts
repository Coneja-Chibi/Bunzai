/** The kind seam generator: the committed seams are current, and a malformed kind folder is refused by name. */
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findKinds, renderKinds, renderSchemas } from "./kind-manifest";

const ROOT = join(import.meta.dir, "..");

test("the committed seams are what the kind folders produce", async () => {
  const found = await findKinds();
  expect(readFileSync(join(ROOT, "src", "generated", "kinds.ts"), "utf8")).toBe(renderKinds(found));
  expect(readFileSync(join(ROOT, "src", "generated", "kind-schemas.ts"), "utf8")).toBe(renderSchemas(found));
});

const descriptor = join(ROOT, "src", "entities", "_shared", "kind-descriptor.ts").replaceAll("\\", "/");
const fakeKind = (root: string, folder: string, id: string, decoder: boolean): void => {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "kind.ts"), `import { defineKind } from "${descriptor}";
export default defineKind({ id: "${id}", order: 1, singular: "X", plural: "Xs", short: "x", receiptWord: "x",
  blurb: "x", icon: "lucide:square", accent: "var(--deck-fog)", libraryDeck: true, describe: () => [] });\n`);
  writeFileSync(join(dir, "runtime-schema.ts"), decoder ? "export const entitySchema = null;\n" : "export const other = 1;\n");
};

test("a kind whose id does not match its folder, or with no decoder, is refused naming the folder", async () => {
  const root = mkdtempSync(join(tmpdir(), "kinds-"));
  fakeKind(root, "widget", "gadget", false);
  const error = await findKinds(root).then(() => null, (e: unknown) => String(e));
  expect(error).toContain(`widget/kind.ts: id "gadget" must match its folder name`);
  expect(error).toContain("widget/runtime-schema.ts: must export entitySchema");
});

test("folders without a kind.ts and _shared folders are not kinds", async () => {
  const root = mkdtempSync(join(tmpdir(), "kinds-"));
  fakeKind(root, "widget", "widget", true);
  mkdirSync(join(root, "capabilities"));
  mkdirSync(join(root, "_shared"));
  expect((await findKinds(root)).map((f) => f.folder)).toEqual(["widget"]);
});
