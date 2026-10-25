/**
 * The library's own routes: where it is (the load-in, locked, unlocked) and the keyring actions the
 * stage door and Settings, Security use ().
 *
 * HOST ONLY. Only the trusted loopback handler is given the library; the remote and LAN handlers
 * never are, and isHostOnlyRoute refuses the prefix there too. Every action is a POST, so the /api
 * gate has already checked Host, Origin, and the session token.
 *
 * SECRETS NEVER LEAVE IN AN ERROR. A password or recovery words arrive in a body and go straight to
 * the keyring; no response or log line carries them. The one response that carries words is the
 * new set from words/begin, which the person must see to write down.
 */
import { WrongSecretError } from "../stage/crypto/crypto";
import { hasErrorName } from "../core/guards";
import { KeyChangedError, KeyringRuleError, ProofRequiredError } from "../stage/crypto/keyring";
import type { LockPolicy } from "../stage/crypto/keyring-rows";
import { isLibraryLocked } from "../studio/errors";
import type { LibraryHandle } from "./library-root";
import { handleCareRoutes } from "./server-library-care";
import { err, json, readJsonObject, studioErr } from "./server-security";

const PREFIX = "/api/library/";
/**
 * Status polls the open screens repeat on a timer (Settings, Security; remote access; updates). They
 * are not the person doing anything, so they never keep an idle library unlocked.
 */
const POLLS = new Set([
  `${PREFIX}status`,
  "/api/remote/status",
  "/api/remote/devices",
  "/api/remote/lan/status",
  "/api/updates/switch-status",
]);

/** Requests that passed the /api gate (Host, Origin, token); only they count as activity. */
const admitted = new WeakSet<Request>();
/** Called by the server once a request has passed its /api gate. */
export const admit = (req: Request): void => void admitted.add(req);

/**
 * The front door for every request. A locked library answers 423 from any route, so the shell shows
 * the stage door and a route that forgot to map the error cannot turn it into a 500. While a request
 * runs, the idle lock waits, so a long import is never cut off halfway. When an admitted request that
 * is not a poll ends, it counts as activity: a request the gate refused (another site, a wrong Host)
 * never keeps the library unlocked.
 */
export function libraryFrontDoor(
  route: (req: Request) => Promise<Response>,
  library: LibraryHandle | undefined,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const p = new URL(req.url).pathname;
    const release = library?.hold();
    try {
      return await route(req);
    } catch (e) {
      if (isLibraryLocked(e)) return studioErr(e);
      throw e;
    } finally {
      release?.();
      if (library && admitted.has(req) && p.startsWith("/api/") && !POLLS.has(p)) library.touch();
    }
  };
}

type Body = Record<string, unknown>;
const text = (b: Body, key: string): string | null => (typeof b[key] === "string" && b[key] !== "" ? (b[key] as string) : null);

function policyOf(value: unknown): LockPolicy | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { mode?: unknown; idleMinutes?: unknown };
  if (v.mode === "each-open") return { mode: "each-open" };
  if (v.mode === "idle" && Number.isSafeInteger(v.idleMinutes) && (v.idleMinutes as number) >= 1) {
    return { mode: "idle", idleMinutes: v.idleMinutes as number };
  }
  return null;
}

/** Maps the keyring's refusals to answers; anything else is logged by name only and answered 500. */
function refusal(e: unknown, action: string): Response {
  if (e instanceof WrongSecretError) return err("that does not open this library", 401);
  // 428, not 403: the /api gate answers 403 for a refused request, and the screens must tell
  // "prove it is you" apart from "not allowed at all".
  if (e instanceof ProofRequiredError) return json({ error: e.message, proof: true }, 428);
  if (e instanceof KeyChangedError || e instanceof KeyringRuleError) return err(e.message, 409);
  // Locked and database-busy share the one mapping every Studio route uses (D18: by name only).
  if (isLibraryLocked(e) || (e instanceof Error && hasErrorName(e, "StageDatabaseError"))) return studioErr(e);
  console.error(`library: could not ${action}:`, e instanceof Error ? e.name : "unknown error");
  return err(`could not ${action}`, 500);
}

export async function handleLibraryRoutes(p: string, req: Request, library: LibraryHandle | undefined): Promise<Response | null> {
  if (!p.startsWith(PREFIX)) return null;
  if (!library) return err("not found", 404);

  if (p === `${PREFIX}status` && req.method === "GET") {
    const phase = await library.phase();
    const opened = library.opened();
    if (!opened) return json(phase);
    const status = await opened.keyring.status();
    const keys = {
      hasPassword: status.hasPassword,
      hasWords: status.hasWords,
      cleanupPending: status.cleanupPending,
      lockPolicy: status.lockPolicy,
      wordsWrittenAt: status.wordsWrittenAt,
      wordsRehearsedAt: status.wordsRehearsedAt,
    };
    if (phase.phase !== "unlocked") return json({ ...phase, ...keys });
    // The load-in screen's summary of a first-start import: pieces in, pieces kept under another id,
    // and everything else left in the folder.
    const imported = opened.imported;
    const copied = imported
      ? { files: imported.pieces, renamed: imported.renamed.map(({ from, to }) => ({ from, to })), leftInFolder: imported.leftInFolder }
      : null;
    // deviceLock costs a vault round trip the first time the id file changes (memoized after that,
    // device-vault.ts). Only Settings, Security reads it (security-api.ts); library-gate.tsx's own
    // status reads never ask for it, so it is left out unless requested.
    const detail = new URL(req.url).searchParams.get("detail") === "1";
    return json({ ...phase, ...keys, copied, ...(detail ? { deviceLock: await opened.keyring.deviceLock() } : {}) });
  }

  const opened = library.opened();
  if (!opened) return err("the library is not open", 409);
  const ring = opened.keyring;

  if (p === `${PREFIX}computers` && req.method === "GET") {
    try {
      return json(await ring.rememberedComputers());
    } catch (e) {
      return refusal(e, "list the computers");
    }
  }

  const care = await handleCareRoutes(p.slice(PREFIX.length), req, opened, async () => (await library.phase()).phase === "unlocked");
  if (care) return care;

  if (req.method !== "POST") return err("not found", 404);
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body: Body = parsed.value;

  try {
    switch (p.slice(PREFIX.length)) {
      case "unlock": {
        const password = text(body, "password");
        const words = text(body, "words");
        if (password) {
          await ring.unlockWithPassword(password);
          return json({ ok: true });
        }
        if (words) return json({ ok: true, ...(await ring.unlockWithWords(words, { rememberComputer: body["rememberComputer"] === true })) });
        return err("give the password or the recovery words", 400);
      }
      case "lock":
        ring.lock();
        // The one lock path createLibrary never itself calls, so it has no other way to learn of
        // it: without this, a "Lock now" push never reaches the studio-events stream, and a client
        // relying on it (library-gate.tsx) would wait on its 15s fallback poll instead of the push.
        library.noticeLocked();
        return json({ ok: true });
      case "prove": {
        const password = text(body, "password");
        const words = text(body, "words");
        if (password) await ring.prove({ password });
        else if (words) await ring.prove({ words });
        else return err("give the password or the recovery words", 400);
        return json({ ok: true });
      }
      case "words/begin":
        return json({ words: ring.beginWords().split(" ") });
      case "words/confirm": {
        const typed = text(body, "words");
        if (!typed) return err("type the words back", 400);
        return json({ ok: true, ...(await ring.confirmWords(typed)) });
      }
      case "words/rehearse": {
        const typed = text(body, "words");
        if (!typed) return err("type your words", 400);
        await ring.rehearse(typed);
        return json({ ok: true });
      }
      case "password": {
        const password = text(body, "password");
        const policy = policyOf(body["lockPolicy"]);
        if (!password || !policy) return err("give a password and when to ask for it (idle minutes: a whole number, at least 1)", 400);
        return json({ ok: true, ...(await ring.setPassword(password, policy)) });
      }
      case "password/remove":
        return json({ ok: true, ...(await ring.removePassword()) });
      case "computers/forget": {
        const id = text(body, "id");
        if (!id) return err("say which computer", 400);
        return json({ ok: true, ...(await ring.forgetComputer(id)) });
      }
      case "cleanup/retry":
        return json({ ok: true, ...(await ring.retryCleanup()) });
      case "device-lock/upgrade":
        return json({ ok: true, ...(await ring.upgradeDeviceLock()) });
      default:
        return err("not found", 404);
    }
  } catch (e) {
    return refusal(e, p.slice(PREFIX.length).replace("/", " "));
  }
}
