/**
 * The carrier a chat-log adapter hands the import path: a finished
 * conversation in Bunzai's own words, with every name still a NAME, because the scene's cast is
 * resolved against the library at save time (src/studio/scene-import.ts), never at read time. It is
 * not a library entity: a scene lives in the ChatStore, so it has no canonical kind, no profiles and no
 * escrow, and `parseCanonicalEntity` refuses it by design. Types, a guard, and the refusal an adapter
 * raises for a chat that has no home.
 */

/** A swipe's generation details, the subset a chat log carries (shapes ChatStore's `Generation`). */
export interface ImportedGeneration {
  model?: string;
  generationMs?: number;
  reasoning?: { text: string; signature?: string; model?: string };
}

export interface ImportedSceneSwipe { content: string; createdAt: number; generation?: ImportedGeneration }

export interface ImportedSceneMessage {
  role: "user" | "assistant" | "system";
  /** The name the log shows for this line: the persona for a user line, the character for a reply. */
  speaker: string;
  createdAt: number;
  swipes: ImportedSceneSwipe[];
  current: number;
  /** Hidden from the prompt in the source (ChatStore rule 30). */
  hidden?: true;
  /** A user line's persona avatar file, without folder or extension: the source's own link to the persona. */
  avatar?: string;
}

export interface ImportedSceneBody {
  /** The format id that read the file. */
  source: string;
  /** Names a reply was written under, most lines first: the library character is looked up by these. */
  characterNames: string[];
  /** The character the log's header names, when it names one: only a fallback, because a card renamed since the chat began leaves it stale. */
  headerCharacter?: string;
  /** Names the person wrote under, most recent first: the persona is looked up by these. */
  personaNames: string[];
  createdAt: number;
  updatedAt: number;
  messages: ImportedSceneMessage[];
  /** The source's chat variables, carried into the take's variables. */
  variables?: Record<string, unknown>;
  /** Plain-words lines about what did not map exactly, shown on the import receipt. */
  notes: string[];
}

export interface ImportedScene { kind: "scene"; id: string; body: ImportedSceneBody }

/** A chat the adapter recognized but will not import, with the reason the person reads. */
export class SceneRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneRefusal";
  }
}

export const isImportedScene = (value: unknown): value is ImportedScene =>
  typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "scene";
