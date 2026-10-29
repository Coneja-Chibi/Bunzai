/**
 * The Director panel's side (plan 15 step 4; RoleCall `story-director-edit.ts`, `sync-dm-context` PATCH, `dm-context/invisible-arcs`, "Reset DM"): what the panel reads, and the few things the
 * person may change: mark an arc complete, remove a seed, an arc, a hidden arc or a note, plant a hidden arc of their own, add a note, clear the activity feed and Reset. Each edit writes a new snapshot
 * at the take's tip, guarded by the version the panel was showing, so an edit made against a state a turn has since moved is refused (409) rather than lost, and is remembered in the state
 * (core/director/edits.ts) so the next version of that reply carries it. A person's own note or hidden arc that is removed moves to the scene's archive (never deleted; the snapshot then holds only what is live); the model's own removed rows stay soft. Reset empties the story fields and keeps the activity, the id counter, the turn and the record of edits.
 * The action runs only while the scene tier table grants `director.edit` the write tier (scene-director-tier.ts).
 */
import { deepEq, recOr } from "../core/guards";
import { emptyDirectorState, liveArcs, liveInvisible, liveNotes, liveSeeds } from "../core/director/state";
import { directorOn, resolveDirector, type ResolvedDirector } from "../core/director/settings";
import { TOO_LARGE, applyEdit, labelOf, record, refusal } from "../core/director/edits";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { DIRECTOR_ACTIVITY_MAX, DIRECTOR_HORIZONS, DIRECTOR_STATE_BYTES_MAX, type DirectorActivity, type DirectorEdit, type DirectorHorizon, type DirectorInvisibleArc, type DirectorNote, type DirectorState } from "../stage/contracts/director-types";
import { tierRefusal, type DirectorTiers } from "./scene-director-tier";
import { publishSceneTrackers } from "./scene-events";
import { withLines } from "./scene-director-trackers";
import { undoTrackerUpdate, type TrackerChats } from "./tracker-state";
import type { TrackerModule } from "../stage/contracts/chat-tracker-types";
import type { ChatConnection, ChatStore } from "../stage/contracts/chat-store";
import type { Connected } from "./scene-turn";
import { StudioConflictError } from "./atomic-file";
import { StudioNotFoundError, StudioValidationError } from "./errors";

/** The tier the table gives panel edits (scene-tiers.ts); `editDirector` refuses to run unless it is write. */
export const DIRECTOR_EDIT_TIER = SCENE_ACTION_TIERS["director.edit"];

/** How many replies the turn stepper keeps (RoleCall's MAX_HISTORY_ENTRIES). */
export const DIRECTOR_HISTORY_MAX = 150;
export const NOTE_MAX = 600;
export const HIDDEN_TITLE_MAX = 200;
export const HIDDEN_TEXT_MAX = 1_200;

export type { DirectorEdit };

/** What the panel shows: the take's story state at its tip, soft-removed items and cleared activity left out. */
export interface DirectorPanel {
  /** The Story Director Prop is in the scene's Props. */
  on: boolean;
  settings: ResolvedDirector;
  state: DirectorState;
  /** The version to send back with an edit; null while the story has no snapshot yet. */
  version: number | null;
  /** The message an edit writes at: the take's last live message; null for a take with none. */
  tip: string | null;
  /** How full the story is: its size as the store counts it, and the most a snapshot may hold, so the page can say when the person's own notes and hidden arcs are getting too many. */
  size: { bytes: number; max: number };
  /**
   * Whether the connection the Director would plan through (its own model, else the narrator's) takes native tools, decided as the turn decides it (scene-director-call.ts: tool-call mode needs a connection that is sent tools, which is every
   * connection but a model that refuses them): `native` (RoleCall's "Native tools available"), `none` ("Tagged recommended"), or `unknown` ("Tool support unknown": no connection, or Kit no longer has it).
   */
  tools: "native" | "none" | "unknown";
  /** What the person removed, kept for them and never deleted (rule 47): their notes and hidden arcs, newest last. Not part of the snapshot, so it never counts against its size. */
  archived: { notes: DirectorNote[]; hidden: DirectorInvisibleArc[] };
  /** The replies on this take that carry a saved story, oldest first and at most DIRECTOR_HISTORY_MAX of the newest (RoleCall steps back through its last 150): the turn stepper's stops. */
  history: { messageId: string; turn: number }[];
  /** The reply whose story `state` is, when the panel was asked for an earlier one (read only: `version` and `tip` still name the latest, which is where an edit goes); null for the latest. */
  at: string | null;
}

export type DirectorEditDeps = { chats: Pick<ChatStore, "getChat" | "readMessagesBefore" | "getDirector" | "putDirector" | "archiveDirector"> & TrackerChats; connect?(connection: ChatConnection): Promise<Connected | null> };

/** The story state as the panel shows it. */
export function publicState(s: DirectorState): DirectorState {
  const cleared = s.activityClearedAt ?? -Infinity;
  return { ...s, arcs: liveArcs(s), seeds: liveSeeds(s), invisibleArcs: liveInvisible(s), notes: liveNotes(s), activity: s.activity.filter((a) => a.at > cleared) };
}

async function tipOf(chats: DirectorEditDeps["chats"], branchId: string): Promise<string | null> {
  const page = await chats.readMessagesBefore(branchId, { limit: 1, liveOnly: true });
  return page.messages.at(-1)?.id ?? null;
}

/** The replies on the take, newest first, whose shown version holds a saved story. A story is in effect from its reply on, so the walk jumps from one saved reply to the one before it. */
async function historyOf(chats: DirectorEditDeps["chats"], chatId: string, branchId: string): Promise<{ messageId: string; turn: number }[]> {
  const out: { messageId: string; turn: number }[] = [];
  let before: number | undefined;
  let ceiling = Infinity;
  for (;;) {
    const page = await chats.readMessagesBefore(branchId, { limit: 100, liveOnly: true, ...(before === undefined ? {} : { beforeSeq: before }) });
    for (const m of [...page.messages].reverse()) {
      if (m.seq > ceiling) continue;
      const snap = await chats.getDirector(chatId, m.id);
      if (!snap) return out;
      if (snap.messageId === m.id) {
        out.push({ messageId: m.id, turn: snap.state.turn ?? 0 });
        if (out.length >= DIRECTOR_HISTORY_MAX) return out;
        ceiling = m.seq - 1;
      } else {
        const holder = page.messages.find((x) => x.id === snap.messageId);
        ceiling = holder ? holder.seq : m.seq - 1;
      }
    }
    if (page.messages.length === 0 || page.nextSeq === undefined || page.nextSeq === null) return out;
    before = page.nextSeq;
  }
}

/** `at` asks for the story saved on an earlier reply of the take (read only); it must be one the take has a story on. */
export async function readDirectorPanel(deps: DirectorEditDeps, chatId: string, opts: { at?: string } = {}): Promise<DirectorPanel> {
  const chat = await deps.chats.getChat(chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  const tip = await tipOf(deps.chats, chat.activeBranchId);
  const latest = tip ? await deps.chats.getDirector(chatId, tip) : null;
  const history = tip ? (await historyOf(deps.chats, chatId, chat.activeBranchId)).reverse() : [];
  let shown = latest;
  if (opts.at !== undefined) {
    if (!history.some((h) => h.messageId === opts.at)) throw new StudioNotFoundError("that reply has no saved story on this take");
    shown = await deps.chats.getDirector(chatId, opts.at);
  }
  const settings = resolveDirector(chat);
  const target = settings.model ?? chat.connection;
  const connected = target && deps.connect ? await deps.connect(target).catch(() => null) : null;
  const tools = connected ? (connected.tools === true ? "native" : "none") : "unknown";
  const size = { bytes: JSON.stringify(shown?.state ?? emptyDirectorState()).length, max: DIRECTOR_STATE_BYTES_MAX };
  const archived = { notes: chat.director?.archive?.notes ?? [], hidden: chat.director?.archive?.hidden ?? [] };
  return { on: directorOn(chat), settings, tools, size, archived, state: publicState(shown?.state ?? emptyDirectorState()), version: latest?.version ?? null, tip, history, at: opts.at ?? null };
}

const text = (v: unknown, what: string, max: number): string => {
  if (typeof v !== "string" || v.trim() === "") throw new StudioValidationError(`${what} must be text`);
  if (v.trim().length > max) throw new StudioValidationError(`${what} must be at most ${max} characters`);
  return v.trim();
};

/** Reads an edit from a request body once; anything else is refused. */
export function readEdit(raw: unknown): DirectorEdit {
  const r = recOr(raw);
  const id = () => text(r["id"], "id", 80);
  switch (r["op"]) {
    case "resolve-arc": case "remove-arc": case "remove-seed": case "remove-hidden": case "remove-note": return { op: r["op"], id: id() };
    case "add-note": return { op: "add-note", content: text(r["content"], "note", NOTE_MAX) };
    case "clear-activity": case "reset": return { op: r["op"] };
    case "add-hidden": {
      const horizon = r["horizon"];
      if (horizon !== undefined && !(DIRECTOR_HORIZONS as readonly unknown[]).includes(horizon)) throw new StudioValidationError("horizon must be immediate, short, medium, long or epic");
      return {
        op: "add-hidden", title: text(r["title"], "title", HIDDEN_TITLE_MAX), ...(r["description"] === undefined ? {} : { description: text(r["description"], "description", HIDDEN_TEXT_MAX) }),
        ...(horizon ? { horizon: horizon as DirectorHorizon } : {}), ...(r["surfaceCondition"] === undefined ? {} : { surfaceCondition: text(r["surfaceCondition"], "surface condition", HIDDEN_TEXT_MAX) }),
      };
    }
    default: throw new StudioValidationError("that is not a Director edit");
  }
}

/** Applies one edit at the tip. `expectedVersion` is the version the panel was showing; a stale one is a conflict and nothing is written. Answers the panel as it is now. */
export async function editDirector(deps: DirectorEditDeps & { now(): number; tiers?: DirectorTiers }, chatId: string, editRaw: unknown, expectedVersion: number | null): Promise<DirectorPanel> {
  const edit = readEdit(editRaw);
  const denied = tierRefusal("director.edit", deps.tiers);
  if (denied) throw new StudioConflictError(denied);
  if (expectedVersion !== null && !Number.isSafeInteger(expectedVersion)) throw new StudioValidationError("expectedVersion must be a whole number or null");
  const panel = await readDirectorPanel(deps, chatId);
  if (!panel.tip) throw new StudioConflictError("this take has no messages for the Director to remember yet");
  if (panel.version !== expectedVersion) throw new StudioConflictError("the Director's state changed since it was shown; reload and try again");
  const snapshot = await deps.chats.getDirector(chatId, panel.tip);
  const at = deps.now();
  const before = snapshot?.state ?? emptyDirectorState();
  const stopped = refusal(before, edit);
  if (stopped) throw new StudioConflictError(stopped);
  const label = labelOf(before, edit);
  // The record's id is chosen first and the add takes its row id from it, so replaying the record makes the same row (core/director/edits.ts).
  // Past every id a carried record may already hold: a take's counter can trail the edits it replayed.
  const num = Math.max(before.nextId, ...(before.edits ?? []).map((e) => Number(/(\d+)$/.exec(e.id)?.[1] ?? 0) + 1));
  const recId = `edit-${num}`;
  const made = applyEdit({ ...before, nextId: num + 1 }, edit, at, label, recId);
  if (!made) throw new StudioNotFoundError("that item is not in the story");
  const { line } = made;
  // What a person removed goes to the scene's archive first: once each by id, so a refused or repeated write below loses nothing and keeps nothing twice.
  if (made.archived && (made.archived.notes.length > 0 || made.archived.hidden.length > 0)) {
    if (!(await deps.chats.archiveDirector(chatId, made.archived))) throw new StudioNotFoundError("that scene does not exist");
  }
  const state = record(made.state, edit, at, label, recId);
  if (line) {
    const entry: DirectorActivity = { id: `act-${state.nextId++}`, at, turn: state.lastDirectiveTurn ?? 0, type: "edit", result: "info", description: line };
    state.activity = [...state.activity, entry].slice(-DIRECTOR_ACTIVITY_MAX);
  }
  const saved = await deps.chats.putDirector(chatId, panel.tip, state, { expectedVersion }).catch((error: unknown) => {
    if (error instanceof StudioValidationError && error.message.includes("too large")) throw new StudioConflictError(TOO_LARGE);
    throw error;
  });
  if (!saved) throw new StudioNotFoundError("that scene does not exist");
  return readDirectorPanel(deps, chatId);
}

/**
 * The person's Undo on a tracker's "Updated" line (plan 16): that tracker goes back to before the update, written as their own edit on that reply (tracker-state.ts), only while it still holds exactly what
 * the update left, and the panel is answered again. A change of theirs since is a conflict that says the tracker was left as it is. Held to the `director.trackers` tier like the update itself.
 */
export async function undoDirectorTracker(deps: DirectorEditDeps & { now(): number; tiers?: DirectorTiers }, chatId: string, module: TrackerModule, messageId: string): Promise<DirectorPanel> {
  const denied = tierRefusal("director.trackers", deps.tiers);
  if (denied) throw new StudioConflictError(denied);
  await undoTrackerUpdate(deps.chats, chatId, module, messageId, deps.now);
  publishSceneTrackers({ chatId, modules: [{ module, outcome: "undone" }] });
  // The reply's own snapshot says so, when it can be written (it is never written onto another reply).
  const snap = await deps.chats.getDirector(chatId, messageId);
  if (snap && snap.messageId === messageId) {
    const line = { at: deps.now(), turn: snap.state.turn ?? 0, type: "tracker" as const, result: "info" as const, description: `Undid the Story Director's update of ${module}` };
    await deps.chats.putDirector(chatId, messageId, withLines(snap.state, [line]), { expectedVersion: snap.version }).catch(() => undefined);
  }
  return readDirectorPanel(deps, chatId);
}
