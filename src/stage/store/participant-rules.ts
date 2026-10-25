/**
 * The input check and the change for a scene's participant roster, applied by every ChatStore
 * implementation so they cannot refuse or keep different things. A change is parsed once here into a known shape and applied whole
 * or refused whole; nothing is ever deleted, RETIRE only marks. Names are compared the way RoleCall's roster does: case and
 * spacing aside.
 */
import { isOneOf, isPlainObject, type Rec } from "../../core/guards";
import {
  CARD_ID, PARTICIPANT_COLORS_MAX, PARTICIPANT_DESCRIPTION_MAX, PARTICIPANT_MAX, PARTICIPANT_NAME_MAX, PARTICIPANT_RUN_MAX, PLAYER_ID,
  type ChatParticipant, type ChatParticipants, type NewParticipant, type ParticipantChange, type ParticipantEdit, type ParticipantPresence,
} from "../contracts/chat-participant-types";
import { checkText, fail } from "./chat-rules";

const PRESENCES: readonly ParticipantPresence[] = ["present", "background", "absent"];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A name as the roster compares it. */
export const nameKey = (name: string): string => name.trim().replace(/\s+/g, " ").toLowerCase();

function checkName(value: unknown): string {
  const raw = checkText(value, "a participant name");
  if (/[\r\n]/.test(raw)) fail("a participant name must be one line");
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > PARTICIPANT_NAME_MAX) fail(`a participant name must be 1 to ${PARTICIPANT_NAME_MAX} characters`);
  return name;
}

function checkDescription(value: unknown): string {
  const text = checkText(value, "a participant description").trim();
  return text.length <= PARTICIPANT_DESCRIPTION_MAX ? text : fail(`a participant description must be at most ${PARTICIPANT_DESCRIPTION_MAX} characters`);
}

function checkColors(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > PARTICIPANT_COLORS_MAX) fail(`colors must be 1 to ${PARTICIPANT_COLORS_MAX} hex colours`);
  return (value as unknown[]).map((c) => (typeof c === "string" && HEX.test(c) ? c.toLowerCase() : fail("a color must be a hex colour like #a1b2c3")));
}

function checkPresence(value: unknown): ParticipantPresence {
  return isOneOf(value, PRESENCES) ? value : fail(`presence must be one of ${PRESENCES.join(", ")}`);
}

function known(value: Rec, what: string, keys: readonly string[]): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${what} has an unknown field: ${key}`);
}

function checkNew(value: unknown): NewParticipant {
  if (!isPlainObject(value)) return fail("a new participant must be a plain object");
  known(value, "a new participant", ["name", "description", "colors", "presence"]);
  const out: NewParticipant = { name: checkName(value["name"]) };
  if (value["description"] !== undefined) out.description = checkDescription(value["description"]);
  if (value["colors"] !== undefined) out.colors = checkColors(value["colors"]);
  if (value["presence"] !== undefined) out.presence = checkPresence(value["presence"]);
  return out;
}

function checkEdit(value: unknown): ParticipantEdit {
  if (!isPlainObject(value)) return fail("an edit must be a plain object");
  known(value, "an edit", ["name", "description", "colors", "presence", "retired"]);
  const out: ParticipantEdit = {};
  if (value["name"] !== undefined) out.name = checkName(value["name"]);
  if (value["description"] !== undefined) out.description = value["description"] === null ? null : checkDescription(value["description"]);
  if (value["colors"] !== undefined) out.colors = value["colors"] === null ? null : checkColors(value["colors"]);
  if (value["presence"] !== undefined) out.presence = value["presence"] === null ? null : checkPresence(value["presence"]);
  if (value["retired"] !== undefined) out.retired = typeof value["retired"] === "boolean" ? value["retired"] : fail("retired must be true or false");
  return out;
}

const idOf = (value: unknown, what: string): string => (typeof value === "string" && value.length > 0 && value.length <= 64 ? value : fail(`${what} must be 1 to 64 characters`));

/** A change, checked; throws StudioValidationError with the reason. */
export function checkParticipantChange(value: unknown): ParticipantChange {
  if (!isPlainObject(value)) return fail("a participant change must be a plain object");
  switch (value["op"]) {
    case "add": {
      known(value, "an add", ["op", "run", "people"]);
      const people = value["people"];
      if (!Array.isArray(people) || people.length === 0 || people.length > PARTICIPANT_RUN_MAX) fail(`an add holds 1 to ${PARTICIPANT_RUN_MAX} people`);
      return { op: "add", run: idOf(value["run"], "run"), people: (people as unknown[]).map(checkNew) };
    }
    case "edit":
      known(value, "an edit", ["op", "id", "edit"]);
      return { op: "edit", id: idOf(value["id"], "id"), edit: checkEdit(value["edit"]) };
    case "main":
      known(value, "a main change", ["op", "id"]);
      return { op: "main", id: value["id"] === null ? null : idOf(value["id"], "id") };
    case "undo":
      known(value, "an undo", ["op", "run"]);
      return { op: "undo", run: idOf(value["run"], "run") };
    default:
      return fail("op must be add, edit, main or undo");
  }
}

/** An override left with nothing to override is dropped, so it is never stored. */
const isEmptyOverride = (p: ChatParticipant): boolean => p.kind !== "npc" && p.name === undefined && p.description === undefined && p.colors === undefined && p.presence === undefined;

/** The roster after a change, or undefined when it holds nothing. `change` is already checked; `newId` and `now` come from the store. */
export function applyParticipantChange(old: ChatParticipants | undefined, change: ParticipantChange, now: number, newId: () => string): ChatParticipants | undefined {
  let people: ChatParticipant[] = (old?.people ?? []).map((p) => ({ ...p }));
  let main = old?.main;
  const taken = (name: string, except?: string) => people.some((p) => p.id !== except && p.name !== undefined && nameKey(p.name) === nameKey(name));
  const retire = (p: ChatParticipant): void => { p.retired = true; if (main === p.id) main = undefined; };

  if (change.op === "add") {
    const seen = new Set<string>();
    for (const n of change.people) {
      if (taken(n.name) || seen.has(nameKey(n.name))) fail(`a participant named ${n.name} is already on the roster`);
      seen.add(nameKey(n.name));
    }
    if (people.length + change.people.length > PARTICIPANT_MAX) fail(`a scene holds at most ${PARTICIPANT_MAX} stored participants`);
    for (const n of change.people) people.push({ id: newId(), kind: "npc", name: n.name, ...(n.description === undefined ? {} : { description: n.description }), ...(n.colors === undefined ? {} : { colors: n.colors }), ...(n.presence === undefined ? {} : { presence: n.presence }), run: change.run, at: now });
  } else if (change.op === "edit") {
    const kind = change.id === CARD_ID ? "card" : change.id === PLAYER_ID ? "player" : null;
    let target = people.find((p) => p.id === change.id);
    if (!target && kind) { target = { id: change.id, kind, at: now }; people.push(target); }
    if (!target) return fail("there is no such participant");
    const { name, description, colors, presence, retired } = change.edit;
    if (name !== undefined) { if (taken(name, target.id)) fail(`a participant named ${name} is already on the roster`); target.name = name; }
    if (description !== undefined) { if (description === null) delete target.description; else target.description = description; }
    if (colors !== undefined) { if (colors === null) delete target.colors; else target.colors = colors; }
    if (presence !== undefined) { if (presence === null) delete target.presence; else target.presence = presence; }
    if (retired === true) { if (target.kind !== "npc") fail("the scene's character and the player follow its cast and cannot be removed"); retire(target); }
    if (retired === false) delete target.retired;
    people = people.filter((p) => !isEmptyOverride(p));
  } else if (change.op === "main") {
    if (change.id === null || change.id === CARD_ID) main = undefined;
    else {
      const target = people.find((p) => p.id === change.id);
      if (change.id !== PLAYER_ID && (!target || target.retired)) fail("only the player or a live participant can be the main");
      main = change.id;
    }
  } else {
    for (const p of people) if (p.run === change.run && !p.retired) retire(p);
  }
  return people.length === 0 && main === undefined ? undefined : { people, ...(main === undefined ? {} : { main }) };
}
