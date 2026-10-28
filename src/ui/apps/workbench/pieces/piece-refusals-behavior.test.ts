/**
 * What the decoders actually refuse, fed to them: every body below is run through the tool, tracker, dice and formula decoders, and every issue they
 * produce (their own messages, those of the shared modules they use, and zod's own defaults for a wrong type or shape) is turned into the sentence the
 * person reads. Each must be a sentence of its own, or be one of the few deliberately left generic, each with its reason. Together with the source walk
 * in piece-refusals.test.ts, a message nobody wrote words for cannot reach the screen unnoticed.
 *
 * The bodies are a valid base per kind with every place in it broken in turn (removed, null, a number, a negative, an enormous number, a fraction,
 * empty text, text, a boolean, a list, an object, an unknown key), plus the semantic refusals each decoder has (a loop of tops, a clashing name, ...).
 */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import { ENTITY_SCHEMAS } from "../../../../generated/kind-schemas";
import { GENERIC, sentenceFor } from "./piece-problem";

type Path = (string | number)[];
type Json = Record<string, unknown>;

const num = (name: string, extra: Json = {}): Json => ({ name, description: "", type: "number", ...extra });

const BASES: Record<string, Json[]> = {
  tracker: [{
    name: "Health", description: "", layout: "record", note: "n", template: "{{tracker::Health::hp}}", icon: "lucide:heart", changes: "card",
    fields: [num("hp", { min: 0, maxField: "hp_max", default: 3, icon: "lucide:heart" }), num("hp_max", { min: 1, max: 9 }), { name: "mood", description: "", type: "choice", choices: ["calm", "tense"], default: "calm" }, { name: "note", description: "", type: "text", default: "x" }],
  }],
  tool: [{
    name: "Attack", description: "d",
    fields: [{ name: "dice", description: "", type: "text", required: true }, { name: "mood", description: "", type: "choice", choices: ["a", "b"], required: false }],
    action: { kind: "roll", field: "dice" },
  }, { name: "Luck", description: "", fields: [], action: { kind: "dice", id: "d1" } }, { name: "Calc", description: "", fields: [], action: { kind: "formula", id: "f1" } }, { name: "Note", description: "", fields: [], action: { kind: "record" } }],
  dice: [
    { name: "Luck", description: "", type: "roll", dice: "2d6+1" },
    { name: "Weather", description: "", type: "table", rows: [{ text: "Clear", weight: 5 }, { text: "Fog", weight: 3 }] },
    { name: "Pool", description: "", type: "pool", pool: { count: 3, sides: 6, target: 5 } },
  ],
  formula: [{ name: "Storm", description: "", text: "{{calc::1 + 2}}" }],
};

/** The refusals each decoder words that no single place's breaking reaches. */
const SEMANTIC: Record<string, Json[]> = {
  tracker: [
    { ...BASES.tracker![0]!, fields: [num("a"), num("a")] },
    { ...BASES.tracker![0]!, fields: [num("a", { maxField: "b" }), num("b", { maxField: "a" })] },
    { ...BASES.tracker![0]!, fields: [num("a", { maxField: "a" })] },
    { ...BASES.tracker![0]!, fields: [num("a", { maxField: "gone" })] },
    { ...BASES.tracker![0]!, fields: [num("a", { maxField: "t" }), { name: "t", description: "", type: "text" }] },
    { ...BASES.tracker![0]!, fields: [num("a", { max: 3, maxField: "b" }), num("b")] },
    { ...BASES.tracker![0]!, fields: [num("a", { min: 5, max: 2 })] },
    { ...BASES.tracker![0]!, fields: [num("a", { max: 2, default: 9 })] },
    { ...BASES.tracker![0]!, fields: [{ name: "a", description: "", type: "text", min: 1 }] },
    { ...BASES.tracker![0]!, fields: [{ name: "a", description: "", type: "choice" }] },
    { ...BASES.tracker![0]!, fields: [{ name: "a", description: "", type: "choice", choices: [] }] },
    { ...BASES.tracker![0]!, fields: [{ name: "a", description: "", type: "choice", choices: ["x", "x"] }] },
    { ...BASES.tracker![0]!, fields: [{ name: "a", description: "", type: "text", choices: ["x"] }] },
    { ...BASES.tracker![0]!, layout: "list", fields: [num("name")] },
    { ...BASES.tracker![0]!, fields: [num("Bad Name")] },
    { ...BASES.tracker![0]!, fields: [num("a", { icon: "nonsense" })] },
    { ...BASES.tracker![0]!, fields: [] },
  ],
  tool: [
    { ...BASES.tool![0]!, fields: [{ name: "a", description: "", type: "text", required: true }, { name: "a", description: "", type: "text", required: true }], action: { kind: "record" } },
    { ...BASES.tool![0]!, fields: [{ name: "dice", description: "", type: "number", required: true }] },
    { ...BASES.tool![0]!, action: { kind: "roll", field: "gone" } },
    { ...BASES.tool![0]!, action: { kind: "dice", id: "" } },
    { ...BASES.tool![0]!, action: { kind: "nonsense" } },
    { ...BASES.tool![0]!, fields: [{ name: "c", description: "", type: "choice", required: false }], action: { kind: "record" } },
    { ...BASES.tool![0]!, fields: [{ name: "c", description: "", type: "choice", choices: [], required: false }], action: { kind: "record" } },
    { ...BASES.tool![0]!, fields: [{ name: "c", description: "", type: "choice", choices: ["x", "x"], required: false }], action: { kind: "record" } },
    { ...BASES.tool![0]!, fields: [{ name: "c", description: "", type: "text", choices: ["x"], required: false }], action: { kind: "record" } },
    { ...BASES.tool![0]!, fields: [{ name: "Bad", description: "", type: "text", required: false }], action: { kind: "record" } },
    { ...BASES.tool![0]!, name: "" },
  ],
  dice: [
    { name: "D", description: "", type: "roll", dice: "abc" },
    { name: "D", description: "", type: "roll", dice: "0d6" },
    { name: "D", description: "", type: "roll", dice: "1d1" },
    { name: "D", description: "", type: "roll", rows: [{ text: "x", weight: 1 }] },
    { name: "D", description: "", type: "table", dice: "1d6" },
    { name: "D", description: "", type: "table", rows: [] },
    { name: "D", description: "", type: "table", rows: [{ text: "", weight: 1 }] },
    { name: "D", description: "", type: "table", rows: [{ text: "a", weight: 0 }] },
    { name: "D", description: "", type: "table", rows: [{ text: "a", weight: 1.5 }] },
    { name: "D", description: "", type: "table", rows: [{ text: "a", weight: 9e15 }, { text: "b", weight: 9e15 }] },
    { name: "D", description: "", type: "pool", pool: { count: 0, sides: 6, target: 5 } },
    { name: "D", description: "", type: "pool", pool: { count: 3, sides: 1, target: 1 } },
    { name: "D", description: "", type: "pool", pool: { count: 3, sides: 6, target: 7 } },
    { name: "D", description: "", type: "pool", pool: { count: 3, sides: 6, target: 0 } },
    { name: "D", description: "", type: "pool", dice: "1d6" },
    { name: "D", description: "", type: "pool", pool: { count: 3, sides: 6, target: 5 }, dice: "1d6" },
    { name: "D", description: "", type: "nonsense" },
  ],
  formula: [{ name: "", description: "", text: "" }, { name: "F", description: "", text: "x".repeat(1_000_001) }],
};

const REPLACEMENTS: unknown[] = [undefined, null, 7, -1, 1e30, 0.5, "", "x", true, [], {}];

/** Every place in a body, containers included. */
function placesIn(value: unknown, at: Path = []): Path[] {
  if (value === null || typeof value !== "object") return [];
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v] as const) : Object.entries(value);
  return entries.flatMap(([key, child]) => [[...at, key], ...placesIn(child, [...at, key])]);
}

function withChange(body: Json, path: Path, value: unknown): Json {
  const copy = structuredClone(body);
  let at: any = copy;
  for (const key of path.slice(0, -1)) at = at[key];
  const last = path[path.length - 1]!;
  if (value === undefined) {
    if (Array.isArray(at)) at.splice(last as number, 1);
    else delete at[last];
  } else at[last] = value;
  return copy;
}

function withExtraKey(body: Json, path: Path): Json {
  const copy = structuredClone(body);
  let at: any = copy;
  for (const key of path) at = at[key];
  if (at !== null && typeof at === "object" && !Array.isArray(at)) at["unknownKey"] = 1;
  return copy;
}

/** Every body to run through a kind's decoder. */
function bodiesFor(kind: string): Json[] {
  const base = BASES[kind]!;
  const broken = base.flatMap((b) => {
    const places = placesIn(b);
    return [
      ...places.flatMap((path) => REPLACEMENTS.map((r) => withChange(b, path, r))),
      ...[[] as Path, ...places].map((path) => withExtraKey(b, path)),
    ];
  });
  return [...broken, ...SEMANTIC[kind]!];
}

interface Seen { sentence: string; code: string; message: string; example: string }

function refusalsOf(kind: string): Map<string, Seen> {
  const schema = ENTITY_SCHEMAS.find((s) => s.shape.kind.value === kind)!;
  const seen = new Map<string, Seen>();
  for (const body of bodiesFor(kind)) {
    const done = schema.safeParse({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id: "draft", body });
    if (done.success) continue;
    for (const issue of done.error.issues) {
      if (issue.path[0] !== "body") continue;
      const sentence = sentenceFor(kind, body, issue as never);
      const key = `${issue.code}|${(issue as { origin?: string }).origin ?? ""}|${issue.message}|${sentence}`;
      if (!seen.has(key)) seen.set(key, { sentence, code: issue.code, message: issue.message, example: issue.path.join(".") });
    }
  }
  return seen;
}

/** Refusals left generic on purpose: the editor builds typed values, so these are a bug in the editor, not an author's mistake with something to fix. */
const DELIBERATELY_GENERIC: { why: string; is(seen: Seen): boolean }[] = [
  { why: "a value of the wrong type: the editor's inputs are typed, so it cannot send one", is: (s) => s.code === "invalid_type" },
  { why: "an unknown key: the editor writes only the keys the kind has", is: (s) => s.code === "unrecognized_keys" },
  { why: "a value outside a closed set (a field type, a layout, a change style, a dice type): the editor offers only the set", is: (s) => s.code === "invalid_value" },
  { why: "no branch of the action union matches: the editor offers only the four actions", is: (s) => s.code === "invalid_union" },
];

describe("every refusal the decoders actually produce is in plain words or deliberately generic", () => {
  for (const kind of ["tool", "tracker", "dice", "formula"]) {
    describe(kind, () => {
      const refusals = refusalsOf(kind);

      test("the broken bodies reach the refusals (a run that reaches few proves nothing)", () => {
        expect(refusals.size).toBeGreaterThan(kind === "formula" ? 3 : 10);
        expect(new Set([...refusals.values()].map((r) => r.code)).has("custom")).toBe(kind !== "formula");
      });

      for (const [key, seen] of refusals) {
        test(`${seen.code} at ${seen.example}: ${seen.message}`, () => {
          const generic = seen.sentence.endsWith(GENERIC);
          if (!generic) return;
          const reason = DELIBERATELY_GENERIC.find((d) => d.is(seen));
          expect(reason, `no plain words for: ${key}`).toBeDefined();
        });
      }

      test("a sentence is never a decoder's raw key or code", () => {
        for (const { sentence } of refusals.values()) expect(sentence).not.toMatch(/maxField|invalid_|Invalid input|expected \w+, received/);
      });
    });
  }
});
