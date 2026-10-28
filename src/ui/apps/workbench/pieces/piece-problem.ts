/**
 * Why a draft piece cannot be saved yet, in words for the person, or null. The kind's own strict decoder is the judge, found through the kind hub (a draft the editor lets
 * through and the decoder refuses would only come back as a failed save); this turns its first complaint into a sentence naming the field.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import { ENTITY_SCHEMAS } from "../../../../generated/kind-schemas";

/** Where in the body a complaint points, as a sentence start: "Field hp", "Row 2", or nothing for the piece itself. */
function whereOf(body: Record<string, unknown>, path: readonly PropertyKey[]): string {
  const list = path[0] === "fields" || path[0] === "rows" ? (body[path[0]] as { name?: string }[] | undefined) : undefined;
  const at = typeof path[1] === "number" ? path[1] : -1;
  if (path[0] === "fields" && at >= 0) return `Field ${list?.[at]?.name ? `"${list[at]!.name}"` : String(at + 1)}`;
  if (path[0] === "rows" && at >= 0) return `Row ${String(at + 1)}`;
  return "";
}

/**
 * The decoders' own refusals in plain words, the one place a refusal is turned into what the person reads (a refusal worded for a developer, with a
 * key name in it, never reaches the screen). A message not listed is one the decoders write for no editor to hit; it is shown as a plain "not valid".
 */
const PLAIN: readonly (readonly [RegExp, string])[] = [
  [/^maxField names no field of this tracker$/, "The top must be a field of this tracker."],
  [/^maxField names a field that is not a number$/, "The top must be a number field."],
  [/^maxField names itself$/, "A field cannot be its own top."],
  [/^maxField is part of a loop of tops$/, "Tops cannot lead back around to the field they belong to."],
  [/^only a number field has a range$/, "Only a number can have a range or a top."],
  [/^a field's top is a number or another field, not both$/, "A field's top is a number or another field, not both."],
  [/^a range's min must be at most its max$/, "From must be at most To."],
  [/^the default must fit the field's type, choices and range$/, "The starting value must fit the field's type, choices and range."],
  [/^field names must be unique$/, "Field names must be different from each other."],
  [/^a list's rows are keyed by name, so no field is called name$/, "A list's rows are keyed by name, so no field can be called name."],
  [/^a roll's field must be one of the tool's text fields$/, "The roll must read one of the tool's text fields."],
  [/^a roll's dice must be (.*)$/, "The dice must be $1."],
  [/^a table's weights add up to an unusually large number$/, "The weights add up to too large a number."],
  [/^only a choice field has choices, and it needs them$/, "A choice field needs choices, and no other field can have them."],
  [/^choices must be unique$/, "No choice can be given twice."],
  [/^a pool's target must be at most its sides$/, "A pool counts at a number no higher than its sides."],
  [/^an? \w+ carries \w+ and nothing else$/, "A piece keeps exactly the field its type rolls."],
];

/** The plain words for a decoder's refusal, or null for one no sentence is written for (a test walks every refusal the decoders word, so none goes unlisted). */
export function plainWords(message: string): string | null {
  for (const [pattern, words] of PLAIN) if (pattern.test(message)) return message.replace(pattern, words);
  return null;
}

/** What is said when a refusal has no sentence of its own: a shape or type error the editor's typed values cannot make. */
export const GENERIC = "Something in this piece is not valid.";

/** The decoder's complaint about one place in the body, as the sentence the person reads. */
export function sentenceFor(kind: string, body: unknown, issue: { path: readonly PropertyKey[]; message: string; code: string; origin?: string }): string {
  // paths are read from the body down
  const path = issue.path.slice(1);
  const last = path[path.length - 1];
  const where = whereOf(body as Record<string, unknown>, path);
  if (path.length === 1 && last === "name") return "Give it a name.";
  if (path.length === 1 && last === "fields" && kind === "tracker") return "A tracker needs at least one field.";
  if (path.length === 3 && last === "name") return `${where} needs a name of lowercase letters, digits and _, starting with a letter.`;
  if (path.length >= 3 && path[2] === "choices") return `${where} needs at least one choice, and no choice twice.`;
  if (path.length === 1 && last === "rows") return "A table needs at least one row.";
  if (path.length === 3 && path[0] === "rows") return `${where} needs some text and a weight of 1 or more.`;
  if (path[0] === "pool") return "A pool needs at least 1 die, dice of at least 2 sides, and a number to count at between 1 and the sides.";
  if (path[0] === "action") return "Pick the piece it uses.";
  const said = plainWords(issue.message) ?? byCode(issue, last) ?? GENERIC;
  return where ? `${where}: ${said}` : said;
}

/** Sentences for the refusals the editor's own inputs can make without a rule of ours behind them: a number out of range, an empty value, an icon id. */
function byCode(issue: { code: string; origin?: string }, last: PropertyKey | undefined): string | null {
  if (last === "maxField" && issue.code === "invalid_format") return "The top must name a field of this tracker.";
  if (last === "icon") return "That icon is not a glyph this app knows.";
  if (issue.origin === "number") return "That number is too large or too small for a piece to hold.";
  if (issue.origin === "string" && issue.code === "too_small") return "A value here cannot be empty.";
  if (issue.code === "too_big") return "That is longer than a piece can hold.";
  return null;
}

export function pieceProblem(kind: string, body: unknown): string | null {
  const schema = ENTITY_SCHEMAS.find((s) => s.shape.kind.value === kind);
  if (!schema) return null;
  const done = schema.safeParse({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id: "draft", body });
  if (done.success) return null;
  return sentenceFor(kind, body, done.error.issues.find((i) => i.path[0] === "body") ?? done.error.issues[0]!);
}
