/**
 * SillyTavern chat codec: a chat's .jsonl file, one JSON record per line. A header line
 * ({ user_name, character_name, chat_metadata }) usually comes first and a very old file has none; every
 * other line is a message { name, is_user, is_system, send_date, mes, swipes?, swipe_id?, swipe_info?,
 * extra?, gen_started?, gen_finished? } (read from real chat files).
 *
 * IMPORT ONLY, and deliberately NOT in the adapter registry (the way `.lvbak` is not): a scene is not a
 * library piece, so it has no `fromCanonical` and the convert/export graph every registered adapter
 * joins does not apply to it. `inspectBytes` calls this for a `.jsonl`; it returns the scene carrier
 * (core/scene-import.ts) with names unresolved, and src/studio/scene-import.ts finds the cast in the
 * library and writes the ChatStore. Mapping decisions, each proven in chat.test.ts:
 *  - `mes` is what the reader saw, so it is the current swipe's text even when `swipes[swipe_id]` disagrees
 *    (many real messages do); an out-of-range `swipe_id` falls back to the swipe that equals `mes`.
 *  - A swipe's model, reasoning and generation time come from its own `swipe_info`; the showing swipe also
 *    reads the message's own copy.
 *  - `is_system` on a user or reply line is SillyTavern's "hidden from the prompt" bit: it becomes the
 *    message's `hidden` flag (ChatStore rule 30) and the receipt counts them. A system NOTICE
 *    (`extra.type`) is a system line.
 *  - A user line's `force_avatar` names the persona's avatar file, ST's own link to the persona: it rides
 *    the carrier as `avatar` and decides which library persona wrote the line (the persona codec owns the
 *    avatar id it was imported under).
 *  - `chat_metadata.variables` become the take's variables; the author's note, timed world info and the
 *    scenario have no field and are listed on the receipt as not carried.
 *  - A group chat (is_group, a `present` list, or replies from two different character avatars) has no
 *    home, because a scene holds one character: it is refused whole, never flattened into one voice.
 */
import type { AdapterInput } from "../../core/adapter";
import { canonicalId } from "../../core/canonical";
import { isRecord, type Rec, strArray } from "../../core/guards";
import { SceneRefusal, type ImportedGeneration, type ImportedScene, type ImportedSceneMessage, type ImportedSceneSwipe } from "../../core/scene-import";
import { parseStTime } from "./chat-dates";
import { plural } from "../../core/text";

const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const isMessage = (r: Rec): boolean => typeof r["mes"] === "string" && typeof r["name"] === "string";

/** Every record of the file; a line that is not a JSON object is counted, not fatal. */
function readRecords(raw: string): { records: Rec[]; skipped: number } {
  const records: Rec[] = [];
  let skipped = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed)) records.push(parsed);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { records, skipped };
}

const isHeader = (r: Rec): boolean => !isMessage(r) && (isRecord(r["chat_metadata"]) || "user_name" in r || "character_name" in r);

function isGroup(records: readonly Rec[]): boolean {
  if (records.some((r) => r["is_group"] === true || Array.isArray(r["present"]))) return true;
  const avatars = new Set(records.filter((r) => isMessage(r) && r["is_user"] !== true && typeof r["original_avatar"] === "string").map((r) => r["original_avatar"]));
  return avatars.size > 1;
}

/** Generation details for one swipe, from whichever record holds them; nothing when it carries none. */
function generationOf(...sources: (Rec | undefined)[]): ImportedGeneration | undefined {
  const out: ImportedGeneration = {};
  for (const src of sources) {
    if (!src) continue;
    const extra = isRecord(src["extra"]) ? src["extra"] : {};
    const model = text(extra["model"]);
    if (model && out.model === undefined) out.model = model;
    const start = parseStTime(src["gen_started"]);
    const end = parseStTime(src["gen_finished"]);
    if (start !== null && end !== null && end >= start && out.generationMs === undefined) out.generationMs = end - start;
    const reasoning = text(extra["reasoning"]);
    if (reasoning && out.reasoning === undefined) {
      const signature = text(extra["reasoning_signature"]);
      out.reasoning = { text: reasoning, ...(signature ? { signature } : {}), ...(model ? { model } : {}) };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

interface Counts { normalized: number; hidden: number; untimed: number }

function messageOf(r: Rec, fallbackTime: number, counts: Counts): ImportedSceneMessage {
  const mes = r["mes"] as string;
  const isUser = r["is_user"] === true;
  const extra = isRecord(r["extra"]) ? r["extra"] : {};
  const notice = r["is_system"] === true && !isUser && typeof extra["type"] === "string";
  const hidden = r["is_system"] === true && !notice;
  if (hidden) counts.hidden += 1;
  const when = parseStTime(r["send_date"]);
  if (when === null) counts.untimed += 1;
  const createdAt = when ?? fallbackTime;
  const listed = strArray(r["swipes"]);
  const swipeId = typeof r["swipe_id"] === "number" ? r["swipe_id"] : -1;
  const info = Array.isArray(r["swipe_info"]) ? r["swipe_info"] : [];
  // What the reader saw is `mes`: it is the current swipe, whatever `swipes[swipe_id]` holds.
  const contents = listed.length > 0 ? [...listed] : [mes];
  let current = Number.isInteger(swipeId) && swipeId >= 0 && swipeId < contents.length ? swipeId : contents.indexOf(mes);
  if (current < 0) {
    contents.push(mes);
    current = contents.length - 1;
    counts.normalized += 1;
  } else if (contents[current] !== mes) {
    contents[current] = mes;
    counts.normalized += 1;
  }
  const swipes: ImportedSceneSwipe[] = contents.map((content, i) => {
    const own = isRecord(info[i]) ? info[i] : undefined;
    const generation = isUser ? undefined : i === current ? generationOf(r, own) : generationOf(own);
    return { content, createdAt: parseStTime(own?.["send_date"]) ?? createdAt, ...(generation ? { generation } : {}) };
  });
  return {
    role: isUser ? "user" : notice ? "system" : "assistant",
    speaker: text(r["name"]) ?? (isUser ? "You" : "Character"),
    createdAt,
    swipes,
    current,
    ...(hidden ? { hidden: true as const } : {}),
    ...(isUser && avatarStem(r["force_avatar"]) ? { avatar: avatarStem(r["force_avatar"])! } : {}),
  };
}

/** The avatar file's name without its folder or extension, from "/thumbnail?type=persona&file=x.png", "User Avatars/x.png" or "x.png". */
function avatarStem(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = /[?&]file=([^&]+)/.exec(value)?.[1] ?? value;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* keep the raw text */ }
  const stem = (decoded.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "");
  return stem === "" ? undefined : stem;
}

/** The chat_metadata a scene has no field for, named for the receipt when it actually holds something. */
function uncarried(meta: Rec): string[] {
  const filled = (v: unknown): boolean => (typeof v === "string" ? v.trim() !== "" : isRecord(v) ? Object.keys(v).length > 0 : Array.isArray(v) ? v.length > 0 : false);
  const timed = isRecord(meta["timedWorldInfo"]) ? Object.values(meta["timedWorldInfo"]).some(filled) : false;
  return [
    ...(filled(meta["note_prompt"]) ? ["the author's note"] : []),
    ...(timed ? ["timed world info"] : []),
    ...(filled(meta["scenario"]) ? ["the scenario"] : []),
  ];
}

const byFrequency = (names: readonly string[]): string[] => {
  const seen = new Map<string, number>();
  for (const n of names) seen.set(n, (seen.get(n) ?? 0) + 1);
  return [...seen].sort((a, b) => b[1] - a[1]).map(([n]) => n);
};

/** The scene carrier for a chat log, or a SceneRefusal (group chat, no messages) the person can read. */
export function readChat(raw: string, filename: string): ImportedScene {
  const { records, skipped } = readRecords(raw);
  const messageRecords = records.filter(isMessage);
  if (messageRecords.length === 0) throw new SceneRefusal("This chat has no messages in it.");
  if (isGroup(records)) {
    const speakers = byFrequency(messageRecords.filter((r) => r["is_user"] !== true && r["is_system"] !== true).map((r) => r["name"] as string));
    throw new SceneRefusal(`This is a group chat${speakers.length > 0 ? ` (${speakers.slice(0, 4).join(", ")})` : ""}. A Bunraku scene has one character, so it cannot hold a group chat yet.`);
  }
  const header = records.find(isHeader);
  const counts: Counts = { normalized: 0, hidden: 0, untimed: 0 };
  const firstTime = messageRecords.map((r) => parseStTime(r["send_date"])).find((t): t is number => t !== null) ?? 0;
  const messages: ImportedSceneMessage[] = [];
  for (const r of messageRecords) messages.push(messageOf(r, messages.at(-1)?.createdAt ?? firstTime, counts));
  const times = messages.flatMap((m) => [m.createdAt, ...m.swipes.map((s) => s.createdAt)]);
  const started = parseStTime(header?.["create_date"]);
  const createdAt = times.reduce((lo, t) => Math.min(lo, t), started ?? Infinity);
  const speakers = (role: "user" | "assistant") => byFrequency(messages.filter((m) => m.role === role).map((m) => m.speaker));
  const headerName = text(header?.["character_name"]);
  const characterNames = speakers("assistant");
  const lastUsers = [...new Set(messages.filter((m) => m.role === "user").map((m) => m.speaker).reverse())];
  const headerUser = text(header?.["user_name"]);
  const notes: string[] = [];
  const swiped = messages.filter((m) => m.swipes.length > 1).length;
  if (swiped > 0) notes.push(`${plural(swiped, "message")} ${swiped === 1 ? "has" : "have"} swipes, all kept.`);
  if (counts.hidden > 0) notes.push(`${counts.hidden} ${counts.hidden === 1 ? "message was" : "messages were"} hidden from the prompt in SillyTavern and stay${counts.hidden === 1 ? "s" : ""} hidden here.`);
  const meta = isRecord(header?.["chat_metadata"]) ? header["chat_metadata"] : {};
  const variables = isRecord(meta["variables"]) ? meta["variables"] : {};
  const varCount = Object.keys(variables).length;
  if (varCount > 0) notes.push(`${varCount} chat ${varCount === 1 ? "variable comes" : "variables come"} along as the take's variables.`);
  const left = uncarried(meta);
  if (left.length > 0) notes.push(`Not carried (a scene has no place for ${left.length === 1 ? "it" : "them"} yet): ${left.join(", ")}. Your .jsonl file keeps ${left.length === 1 ? "it" : "them"}.`);
  if (counts.normalized > 0) notes.push(`${counts.normalized} ${counts.normalized === 1 ? "message's" : "messages'"} shown text and swipe list disagreed; the text that was showing is kept.`);
  if (counts.untimed > 0) notes.push(`${counts.untimed} ${counts.untimed === 1 ? "message has" : "messages have"} no readable time, so ${counts.untimed === 1 ? "it takes" : "they take"} the time of the line before.`);
  if (skipped > 0) notes.push(`${skipped} unreadable ${skipped === 1 ? "line was" : "lines were"} skipped.`);
  return {
    kind: "scene",
    id: canonicalId(`chat ${filename.replace(/\.jsonl$/i, "")}`),
    body: {
      source: CHAT_FORMAT_ID,
      characterNames,
      ...(headerName && headerName !== "unused" ? { headerCharacter: headerName } : {}),
      personaNames: [...lastUsers, ...(headerUser && headerUser !== "unused" && !lastUsers.includes(headerUser) ? [headerUser] : [])],
      createdAt,
      updatedAt: times.reduce((hi, t) => Math.max(hi, t), 0),
      messages,
      ...(varCount > 0 ? { variables } : {}),
      notes,
    },
  };
}

/** Whether the file is a chat log: a .jsonl whose first line is a header or a message. */
export function looksLikeChat(input: AdapterInput): boolean {
  if (!/\.jsonl$/i.test(input.filename ?? "") || typeof input.text !== "string") return false;
  const end = input.text.indexOf("\n");
  try {
    const parsed: unknown = JSON.parse((end === -1 ? input.text : input.text.slice(0, end)).trim());
    return isRecord(parsed) && (isMessage(parsed) || isHeader(parsed));
  } catch {
    return false;
  }
}

/** The format id on the receipt and the carrier. */
export const CHAT_FORMAT_ID = "sillytavern-chat";
