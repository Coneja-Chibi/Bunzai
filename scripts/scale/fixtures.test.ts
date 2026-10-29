/** Force the synthetic scale fixture registry to stay aligned with shipped entity and owner kinds. */
import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { STUDIO_ENTITY_KINDS } from "../../src/studio/path-policy";
import { parseCanonicalEntity } from "../../src/entities/runtime-schema";
import { characters } from "./fixtures/character";
import { htmldocs } from "./fixtures/htmldoc";
import { lorebook } from "./fixtures/lorebook";
import { pack } from "./fixtures/pack";
import { personas } from "./fixtures/persona";
import { preset } from "./fixtures/preset";
import { quickReplySet } from "./fixtures/quickreply";
import { promptFormat } from "./fixtures/promptformat";
import { regexSet } from "./fixtures/regex";
import { dice } from "./fixtures/dice";
import { formula } from "./fixtures/formula";
import { scriptSheet } from "./fixtures/scriptsheet";
import { skill } from "./fixtures/skill";
import { tool } from "./fixtures/tool";
import { tracker } from "./fixtures/tracker";

const NON_ENTITY_OWNER_KINDS = ["chat", "studio-document", "asset"] as const;

async function entityFolders(): Promise<string[]> {
  const dirs = (await readdir("src/entities", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
  const schemas = await Promise.all(dirs.map(async (dir) => await Bun.file(`src/entities/${dir}/runtime-schema.ts`).exists() ? dir : null));
  return schemas.filter((dir): dir is string => dir !== null);
}

async function requireFixture(kind: string): Promise<void> {
  expect(await Bun.file(`scripts/scale/fixtures/${kind}.ts`).exists()).toBe(true);
}

test("entity schema folders and studio path policy stay in sync", async () => {
  expect(await entityFolders()).toEqual([...STUDIO_ENTITY_KINDS].sort());
});

test("every Studio entity kind has a scale fixture owner", async () => {
  for (const kind of STUDIO_ENTITY_KINDS) await requireFixture(kind);
});

test("every scale entity fixture is accepted by the registered canonical parser", () => {
  const values = [
    characters(1).next().value!, lorebook(1), [...personas(1)][0]!, pack(1), regexSet(1),
    preset(1), [...htmldocs(1)][0]!, quickReplySet(1), promptFormat(1),
    dice(1), formula(1), scriptSheet(1), skill(1), tool(1), tracker(1),
  ];
  expect(values.map((value) => parseCanonicalEntity(value).kind).sort()).toEqual([...STUDIO_ENTITY_KINDS].sort());
});

test("non-piece content owners in the scale plan have fixture owners", async () => {
  for (const kind of NON_ENTITY_OWNER_KINDS) await requireFixture(kind);
});
