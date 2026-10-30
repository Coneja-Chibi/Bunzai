/**
 * JanitorAI export: the PNG must land in Janitor's form with the definition in Personality and the
 * bio in Description. Janitor's importer reads only `chara` and takes its V1 branch when all six
 * top-level mirror fields are present; these tests pin exactly that shape.
 */
import { expect, test } from "bun:test";
import { characterAdapter as janitor } from "./index";
import janitorFamily from "./index";
import stWorldbook from "../sillytavern/lorebook";
import { hostCard, textChunks } from "../_fixtures/host-card";
import { asText } from "../_fixtures/as-text";
import { readFileSync } from "node:fs";
import { characterAdapter as sillytavern } from "../sillytavern/index";

const SERAPHINA = new Uint8Array(readFileSync("samples/sillytavern/characters/Seraphina.png"));

const DATA = {
  name: "Vera",
  description: "A lighthouse keeper who never sleeps.",
  personality: "Watchful, dry, kind under it.",
  scenario: "A storm rolls in.",
  first_mes: "You came back.",
  mes_example: "{{user}}: Hi\n{{char}}: Hm.",
  creator_notes: "Slow-burn keeper bot.",
  alternate_greetings: ["Another night."],
  tags: ["fantasy"],
};

const V1_KEYS = ["name", "description", "personality", "scenario", "first_mes", "mes_example"];

test("writes only the chara chunk, never ccv3, even for a V3 card", () => {
  const out = janitor.fromCanonical(hostCard(DATA, "v3"));
  expect(out.suggestedExtension).toBe("png");
  const chunks = textChunks(out.bytes!);
  expect(Object.keys(chunks)).toEqual(["chara"]);
  expect(chunks.chara!.spec).toBe("chara_card_v2");
});

test("top-level mirrors put the definition where Janitor's V1 branch reads Personality", () => {
  const card = textChunks(janitor.fromCanonical(hostCard(DATA)).bytes!).chara!;
  for (const key of V1_KEYS) expect(typeof card[key]).toBe("string");
  expect(card.description).toBe(`${DATA.description}\n\n${DATA.personality}`);
  expect(card.personality).toBe(DATA.creator_notes); // Janitor's public bio
  expect(card.first_mes).toBe(DATA.first_mes);
  expect(card.mes_example).toBe(DATA.mes_example);
  // `data` stays a normal V2 card for every other reader.
  const data = card.data as Record<string, unknown>;
  expect(data.description).toBe(DATA.description);
  expect(data.personality).toBe(DATA.personality);
});

test("the report names what Janitor drops and warns on its required fields", () => {
  const full = janitor.fromCanonical(hostCard(DATA)).report!;
  expect(full.dropped).toContain("greetings.alternateGreetings");
  expect(full.dropped).toContain("discovery.tags");
  expect(full.warnings).toEqual([]);
  const empty = janitor.fromCanonical(hostCard({ name: "Blank" })).report!;
  expect(empty.warnings.some((w) => w.includes("Personality"))).toBe(true);
  expect(empty.warnings.some((w) => w.includes("first message"))).toBe(true);
});

test("no PNG art is a refusal", () => {
  expect(() => janitor.fromCanonical(hostCard(DATA, "v2", false))).toThrow(/PNG card/);
});

test("a set portrait is the PNG's pixels, never a second copy inside its own card", () => {
  const entity = hostCard(DATA);
  const portraitBytes = Buffer.from(String(entity.body.media.portrait!.ref).split(",")[1]!, "base64").length;
  const out = janitor.fromCanonical(entity).bytes!;
  expect(out.length).toBeLessThan(portraitBytes + 20_000);
  expect(JSON.stringify(textChunks(out).chara)).not.toContain("data:image");
});

test("never claims a file on import; the ST reader keeps Janitor-bound PNGs", () => {
  const png = janitor.fromCanonical(hostCard(DATA)).bytes!;
  expect(janitor.detect({ bytes: png })).toBe(0);
});

test("the lorebook codec writes the same ST world info the ST codec writes", () => {
  const lorebook = janitorFamily[1]!;
  expect(lorebook.kind).toBe("lorebook");
  expect(lorebook.detect(asText({ entries: { 0: { key: ["a"], content: "x" } } }))).toBe(0);
  const book = stWorldbook.toCanonical(asText({ name: "Lore", entries: { 0: { uid: 0, key: ["lamp"], content: "It never goes out." } } }));
  expect(lorebook.kind === "lorebook" && lorebook.fromCanonical(book).text).toBe(stWorldbook.fromCanonical(book).text!);
});

test("an imported PNG card exports with its own pixels when no portrait was set", () => {
  // The Studio stores an imported card's art only as the source carrier, not in body.media.
  const imported = sillytavern.toCanonical({ bytes: SERAPHINA, filename: "Seraphina.png" });
  expect(imported.body.media.portrait).toBeUndefined();
  const out = janitor.fromCanonical(imported);
  expect(Object.keys(textChunks(out.bytes!))).toEqual(["chara"]);
});
