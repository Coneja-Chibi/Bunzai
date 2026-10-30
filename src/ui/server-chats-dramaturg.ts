/**
 * The Dramaturg's routes (specs/stage/dramaturg.md; ChatStore rule 48). `GET /api/chats/dramaturg` answers the panel: the conversation and
 * settings, whether the Prop is on, the model that would answer, whether it takes tools and whether a turn is running. `POST
 * /api/chats/dramaturg-settings` and `/dramaturg-clear` write and answer the panel again. `POST /api/chats/dramaturg-turn` asks a question:
 * a refusal is plain HTTP before anything streams (scene-dramaturg.ts says which status), and an accepted turn streams server-sent events
 * that end with `done`, `failed` or `stopped`. The turn is not tied to this request: a page that leaves does not stop it, `POST
 * /api/chats/dramaturg-stop` does. Bodies are parsed once into known types.
 */
import { isRecord, str } from "../core/guards";
import { dramaturgOn, resolveDramaturg } from "../core/dramaturg/settings";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { DramaturgPanel, DramaturgStreamEvent } from "./app-contract-dramaturg";
import { StudioNotFoundError, StudioValidationError } from "../studio/errors";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import { dramaturgBusy, prepareDramaturgTurn, stopDramaturg, type DramaturgDeps } from "../studio/scene-dramaturg";
import type { Connected } from "../studio/scene-turn";
import type { ReadPreset } from "../studio/scene-turn-load";
import type { ReadLorebook } from "../studio/scene-lore";
import { choiceDefaultsOf } from "./server-scene-readers";
import { connect } from "../kit/providers/scene-connect";
import { sceneRuntimeFor } from "./server-scene-runtime";
import { json } from "./server-security";

type Body = Record<string, unknown>;
type Connect = (pick: { id: string; model: string }, signal?: AbortSignal) => Promise<Connected | null>;

/** The panel for a scene: what it shows is what the store holds now. */
export async function readDramaturgPanel(chats: ChatStore, chatId: string, link: Connect = connect): Promise<DramaturgPanel> {
  const chat = chatId ? await chats.getChat(chatId) : null;
  const thread = chat ? await chats.getDramaturg(chatId) : null;
  if (!chat || !thread) throw new StudioNotFoundError("that scene does not exist");
  const settings = resolveDramaturg(thread.settings);
  const model = settings.model ?? chat.connection ?? null;
  const connected = model ? await link(model).catch(() => null) : null;
  return { thread, on: dramaturgOn(chat), model, tools: connected ? (connected.tools === true ? "native" : "none") : "unknown", busy: dramaturgBusy(sceneRuntimeFor(chats), chatId) };
}

const revisionOf = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw new StudioValidationError("revision must be a whole number");
  return v;
};

/** How often a comment line keeps the stream alive while the model thinks: Bun drops a connection idle for 120 seconds, and thinking sends nothing. */
const PING_MS = 20_000;

/** One turn as a stream of server-sent events; the work goes on when the page leaves, so the request's own signal is not passed. */
function streamTurn(run: (emit: (event: DramaturgStreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: DramaturgStreamEvent): void => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)); } catch { open = false; }
      };
      const ping = setInterval(() => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { open = false; }
      }, PING_MS);
      try { await run(emit); } finally {
        clearInterval(ping);
        if (open) { open = false; try { controller.close(); } catch { /* the page already went */ } }
      }
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

/** The Dramaturg routes, or null when the path is not one of them. `link` reaches a model; a test passes its own. */
export async function handleDramaturgRoute(
  req: Request, url: URL, chats: ChatStore, readPreset: ReadPreset, readLorebook: ReadLorebook, b: Body | null, studio?: StudioStoreLike, settings?: SettingsStoreLike, link: Connect = connect,
): Promise<Response | null> {
  const p = url.pathname;
  if (req.method === "GET" && p === "/api/chats/dramaturg") return json(await readDramaturgPanel(chats, url.searchParams.get("chatId") ?? "", link));
  if (req.method !== "POST" || !b || !p.startsWith("/api/chats/dramaturg")) return null;
  const chatId = str(b["chatId"]);
  if (!chatId) throw new StudioValidationError("chatId is required");
  if (p === "/api/chats/dramaturg-settings") {
    if (!isRecord(b["patch"])) throw new StudioValidationError("patch must be an object");
    if (!(await chats.setDramaturgSettings(chatId, b["patch"] as never))) throw new StudioNotFoundError("that scene does not exist");
    return json(await readDramaturgPanel(chats, chatId, link));
  }
  if (p === "/api/chats/dramaturg-clear") {
    if (!(await chats.clearDramaturg(chatId, { expectedRevision: revisionOf(b["revision"]) }))) throw new StudioNotFoundError("that scene does not exist");
    return json(await readDramaturgPanel(chats, chatId, link));
  }
  if (p === "/api/chats/dramaturg-stop") return json({ stopped: stopDramaturg(sceneRuntimeFor(chats), chatId, b["revision"] === undefined ? undefined : revisionOf(b["revision"])) });
  if (p === "/api/chats/dramaturg-turn") {
    const question = typeof b["question"] === "string" ? b["question"] : "";
    const choices = choiceDefaultsOf(settings);
    const deps: DramaturgDeps = {
      runtime: sceneRuntimeFor(chats), chats, connect: link, readPreset, readLorebook, now: Date.now,
      ...(studio ? { readLibrary: (kind, id) => studio.read(kind, id) } : {}),
      ...(choices ? { choiceDefaults: choices } : {}),
    };
    const turn = await prepareDramaturgTurn(deps, { chatId, question, revision: revisionOf(b["revision"]) });
    if (!turn.ok) return json({ error: turn.message }, turn.status);
    return streamTurn((emit) => turn.run(emit));
  }
  return null;
}
