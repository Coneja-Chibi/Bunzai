/**
 * Saving an imported chat: the one place a scene carrier from a chat-log
 * adapter becomes a scene. It rides the same import route as every piece (save-bundle, or save-staged for
 * a large file) and ends in the ChatStore's own `createChat`, so there is no second writer. The cast is
 * resolved HERE, against the library as it is now, by name, the way SillyTavern links a chat to its card:
 * a character that is not in the library, or that two cards answer to, refuses the file, and nothing is
 * written. The frozen cast is built by `freezeCast`, exactly as a new scene's is (snapshot version 1).
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ChatHistory, ChatStore, ImportedMessage, JsonObject } from "../stage/contracts/chat-store";
import type { StudioStoreLike } from "./contracts";
import { ChatAlreadyImportedError, StudioValidationError } from "./errors";
import { toErrorMessage } from "../error-message";
import { varsDeltas } from "../core/scene-state/vars-bridge";
import type { BundleSaveResult } from "./bundle";
import { libraryChatsFor } from "./library-content";
import { freezeCast, requireChats } from "./scenes";

const generation = z.strictObject({
  model: z.string().optional(),
  generationMs: z.number().optional(),
  reasoning: z.strictObject({ text: z.string(), signature: z.string().optional(), model: z.string().optional() }).optional(),
});
const swipe = z.strictObject({ content: z.string(), createdAt: z.number(), generation: generation.optional() });
const message = z.strictObject({
  role: z.enum(["user", "assistant", "system"]),
  speaker: z.string(),
  hidden: z.literal(true).optional(),
  avatar: z.string().optional(),
  createdAt: z.number(),
  swipes: z.array(swipe).min(1),
  current: z.number(),
});
const carrier = z.strictObject({
  kind: z.literal("scene"),
  id: z.string(),
  body: z.strictObject({
    source: z.string(),
    characterNames: z.array(z.string()),
    headerCharacter: z.string().optional(),
    personaNames: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number(),
    messages: z.array(message).min(1),
    variables: z.record(z.string().min(1), z.unknown()).optional(),
    notes: z.array(z.string()),
  }),
});

/** What a name has to match: case, spacing, punctuation and Unicode width do not tell two cards apart ("VALORANT: Between Two Earths" is the file "VALORANT Between Two Earths"). */
const fold = (name: string): string => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

interface Named { id: string; name: string }

/** The one library entry a name answers to, null when none does; two is a refusal for a character (`what` names it), a skip for a persona (`null`), never a guess. */
function pick(pool: readonly Named[], names: readonly string[], what: string | null): Named | null {
  for (const name of names) {
    if (fold(name) === "") continue;
    const hits = pool.filter((p) => fold(p.name) === fold(name));
    if (hits.length > 1 && what === null) continue;
    if (hits.length > 1) throw new StudioValidationError(`${hits.length} ${what}s in your library are called "${name}", so this chat cannot tell which one it belongs to.`);
    if (hits.length === 1) return hits[0]!;
  }
  return null;
}

/**
 * The source a scene is recorded under (ChatStore rule 33): the source app, the file's own character name
 * (never the library's id for it), the start time, and a hash of every message in a fixed order. The same
 * file always gives the same source, so importing it again finds the scene it already made.
 */
function sourceOf(body: z.infer<typeof carrier>["body"]): string {
  const hash = createHash("sha256");
  const put = (value: string | number): void => { const text = String(value); hash.update(`${text.length}:${text}`); };
  put(body.headerCharacter ?? body.characterNames[0] ?? "");
  put(body.createdAt);
  for (const m of body.messages) {
    put(m.role); put(m.speaker); put(m.avatar ?? ""); put(m.createdAt); put(m.hidden ? 1 : 0); put(m.current); put(m.swipes.length);
    for (const s of m.swipes) { put(s.content); put(s.createdAt); }
  }
  return `${body.source}:${hash.digest("hex")}`.slice(0, 200);
}

export interface ImportedSceneSummary { sceneId: string; title: string; messageCount: number }

/** The ST avatar stem a persona entity was imported under (the persona codec owns this id), or undefined. */
export type PersonaAvatarOf = (persona: unknown) => string | undefined;

/**
 * The persona a user line names. SillyTavern links a line to its persona by avatar file, so that wins when
 * exactly one library persona was imported under it; otherwise the name decides, and a name two personas
 * share stamps nothing: a guess here would put words in the wrong persona's mouth.
 */
async function personaResolver(studio: StudioStoreLike, avatarOf: PersonaAvatarOf, wantsAvatars: boolean) {
  const personas = await studio.list("persona");
  const byAvatar = new Map<string, Named | null>();
  if (wantsAvatars) {
    for (const p of personas) {
      const stem = avatarOf(await studio.read("persona", p.id))?.toLowerCase();
      if (stem !== undefined) byAvatar.set(stem, byAvatar.has(stem) ? null : p);
    }
  }
  return (speaker: string, avatar?: string): Named | null =>
    (avatar === undefined ? undefined : byAvatar.get(avatar.toLowerCase())) ?? pick(personas, [speaker], null);
}

/**
 * Saves one carrier as a scene. Refuses (StudioValidationError, nothing written) when the carrier is
 * malformed, its character is not in the library or is ambiguous, or the same chat is already a scene
 * (ChatAlreadyImportedError, naming that scene).
 */
export async function importScene(chats: ChatStore, studio: StudioStoreLike, raw: unknown, avatarOf: PersonaAvatarOf): Promise<ImportedSceneSummary> {
  const parsed = carrier.safeParse(raw);
  if (!parsed.success) throw new StudioValidationError("that chat is not in a shape Bunzai can save");
  const { body } = parsed.data;
  const characters = await studio.list("character");
  const character = pick(characters, [...body.characterNames, ...(body.headerCharacter ? [body.headerCharacter] : [])], "character");
  if (!character) {
    const wanted = body.characterNames[0] ?? body.headerCharacter;
    throw new StudioValidationError(`its character${wanted ? `, "${wanted}",` : ""} is not in your library. Import the card first, then this chat.`);
  }
  const matched = new Set(body.characterNames.flatMap((n) => characters.filter((c) => fold(c.name) === fold(n)).map((c) => c.id)));
  if (matched.size > 1) throw new StudioValidationError("its replies were written under more than one character from your library, and a scene has one.");
  // A scene made before sources were recorded carries none, so the start time and length still name it; this is before any card is read.
  for (const chat of (await chats.listChats({ characterId: character.id })).chats) {
    if (chat.createdAt === body.createdAt && (await chats.countMessages(chat.activeBranchId)) === body.messages.length) {
      throw new ChatAlreadyImportedError(chat.id, `this chat is already in your scenes (${chat.title}).`);
    }
  }
  const who = await personaResolver(studio, avatarOf, body.messages.some((m) => m.avatar !== undefined));
  const stamps = new Map<string, Named | null>();
  const stampOf = (speaker: string, avatar?: string): Named | null => {
    const key = `${avatar ?? ""}\u0000${speaker}`;
    if (!stamps.has(key)) stamps.set(key, who(speaker, avatar));
    return stamps.get(key)!;
  };
  const users = body.messages.filter((m) => m.role === "user");
  // The persona the scene plays now: the most recent user line that names one in the library, then the header's name.
  const scenePersona = [...users].reverse().map((m) => stampOf(m.speaker, m.avatar)).find((p) => p !== null)
    ?? body.personaNames.map((n) => who(n)).find((p) => p !== null) ?? null;
  const messages: ImportedMessage[] = body.messages.map((m) => {
    const persona = m.role === "user" ? stampOf(m.speaker, m.avatar) : null;
    if (m.current >= m.swipes.length) throw new StudioValidationError("that chat is not in a shape Bunzai can save");
    return { role: m.role, createdAt: m.createdAt, current: m.current, swipes: m.swipes, ...(m.hidden ? { hidden: true } : {}), ...(persona ? { persona: { id: persona.id, name: persona.name } } : {}) };
  });
  const history: ChatHistory = { createdAt: body.createdAt, updatedAt: body.updatedAt, messages, source: sourceOf(body) };
  const frozen = await freezeCast(studio, character.id, scenePersona?.id);
  const chat = await chats.createChat({ ...frozen, history });
  if (body.variables && Object.keys(body.variables).length > 0) {
    try {
      // What the chat started with: the take's base, before any message, so no greeting, cut or take changes it (ChatStore rule 17).
      await chats.setBranchBase(chat.activeBranchId, varsDeltas({ set: body.variables as JsonObject, delete: [] }, body.createdAt));
    } catch (error) {
      await chats.deleteChat(chat.id); // a scene that lost its variables is not the chat that was imported
      throw new StudioValidationError(`its chat variables could not be saved, so the chat was not imported (${toErrorMessage(error, "unknown error")}).`);
    }
  }
  return { sceneId: chat.id, title: chat.title, messageCount: messages.length };
}

/** The save-bundle / save-staged answer for a scene: a refusal is a result the sheet lists by file, a locked library is the usual 423. */
export async function saveScene(store: StudioStoreLike, raw: unknown, avatarOf: PersonaAvatarOf): Promise<BundleSaveResult> {
  const chats = requireChats(libraryChatsFor(store.studioPath()));
  try {
    return { ok: true, related: [], scene: await importScene(chats, store, raw, avatarOf) };
  } catch (error) {
    if (error instanceof ChatAlreadyImportedError) {
      return { ok: false, related: [], error: error.message, alreadyImported: { sceneId: error.chatId, title: (await chats.getChat(error.chatId))?.title ?? "" } };
    }
    if (error instanceof StudioValidationError) return { ok: false, related: [], error: error.message };
    throw error;
  }
}
