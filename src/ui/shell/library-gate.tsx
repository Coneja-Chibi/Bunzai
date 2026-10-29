/**
 * The library gate: what the window shows before the Studio (rule
 * 12). It reads GET /api/library/status at start, again whenever any call answers 423, and on a
 * lock/unlock pushed over the studio-events stream - a poll only
 * while "opening" or "loading-in", since the load-in screen's progress moves on it, plus a slow
 * fallback poll for the rare case the stream itself is not watching (a remote or LAN session, which
 * never reaches the host-only stream at all; or a host stream that is briefly down). Locked means
 * the stage door and nothing else (decision 2); a first start that copies
 * a folder in shows the load-in. Built from the approved wireframes 01-stage-door and 06-load-in.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import { apiFetchJson, apiStatusIs, LIBRARY_LOCKED_EVENT } from "../_shared/api-fetch";
import { toErrorMessage } from "../_shared/error-message";
import { attachCacheLockListener } from "../_shared/caches";
import { useVisibleInterval } from "../_shared/use-visible-interval";
import { webStorage } from "../_shared/web-storage";
import { useStudioChangeStream, useStudioChanges } from "../agent/use-studio-changes";
import { PieceStore } from "../_shared/piece-store";
import { CueGrid, Direction, Dossier, GhostButton, Lines, SecretField, StageActions, StageNote, Voice } from "../components/stage-dossier";
import { ProtectedDialog } from "../_shared/protected-dialog";
import { Toggle } from "../components/button";
import styles from "./library-gate.module.css";

export interface Status {
  phase: "opening" | "loading-in" | "failed" | "locked" | "unlocked";
  done?: number;
  total?: number;
  recent?: string[];
  reason?: string | null;
  /** A first-start import refused for want of space: shown as its own screen. */
  noRoom?: boolean;
  hasPassword?: boolean;
  hasWords?: boolean;
  copied?: { files: number; renamed: { from: string; to: string }[]; leftInFolder: number } | null;
}

const SEEN_LOAD_IN = "bunzai.library.loadInSeen";
const TWELVE = (): string[] => Array.from({ length: 12 }, () => "");
const session = webStorage("session");
const seen = (key: string): boolean => {
  try {
    return session?.getItem(key) === "1";
  } catch {
    return false;
  }
};
const markSeen = (key: string): void => {
  try {
    session?.setItem(key, "1");
  } catch {
    /* a private window: the note shows again next time, which is harmless */
  }
};

const post = (path: string, body: unknown): Promise<unknown> =>
  apiFetchJson(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function Stage({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ProtectedDialog variant="full" ariaLabel="The stage door" className={styles.stage}>
      <div className={styles.inner}>{children}</div>
    </ProtectedDialog>
  );
}

/**
 * What a failed status check means. The library's routes answer 403 or 404 only where they are not
 * served at all (a remote or LAN window, the browser build): there the Studio decides alone. Any
 * other failure (the server down or restarting, a 500) is not a reason to show the Studio over a
 * library that may be locked, so it reads as "failed" and offers to try again.
 */
export function statusOnError(e: unknown): Status {
  if (apiStatusIs(e, 403) || apiStatusIs(e, 404)) return { phase: "unlocked" };
  return { phase: "failed", reason: "the studio server did not answer" };
}

export type GateScreen = "load-in" | "stage-door" | "failed" | "no-room" | "all-aboard" | "studio";

/**
 * Which screen the window shows for a library status. The Studio only when the library is open and
 * unlocked; everything else keeps it hidden (the app never runs on a plain folder).
 */
export function gateScreen(status: Status, notes: { loadInSeen: boolean }): GateScreen {
  switch (status.phase) {
    case "opening":
    case "loading-in":
      return "load-in";
    case "locked":
      return "stage-door";
    case "failed":
      return status.noRoom ? "no-room" : "failed";
    case "unlocked":
      return status.copied && !notes.loadInSeen ? "all-aboard" : "studio";
    default:
      return "stage-door";
  }
}

/** The stage door: the password, or the lines (a new computer, or a forgotten password). */
export function StageDoor({ status }: { status: Status }): JSX.Element {
  const [withLines, setWithLines] = useState(!status.hasPassword);
  const [password, setPassword] = useState("");
  const [cues, setCues] = useState(TWELVE);
  const [remember, setRemember] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      if (withLines) await post("/api/library/unlock", { words: cues.join(" "), rememberComputer: remember && !status.hasPassword });
      else await post("/api/library/unlock", { password });
      window.location.reload();
    } catch (e) {
      if (apiStatusIs(e, 401)) {
        setProblem(withLines ? "Those lines do not open this library. Check your script." : "That password does not open this library. Check caps lock, or use your recovery words.");
      } else setProblem(toErrorMessage(e, "something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  if (!status.hasPassword && !status.hasWords) {
    return (
      <Stage>
        <Dossier act="The stage door" title="Not this" accent="computer">
          <StageNote label="Line flub" tone="flub">
            This library was set up on another computer and has no password or recovery words, so it cannot be opened here. Open it on the computer that made it.
          </StageNote>
        </Dossier>
      </Stage>
    );
  }

  if (withLines) {
    return (
      <Stage>
        <Dossier act="The stage door" title="Recite your" accent="lines">
          <Direction>
            The <b>PLAYER</b> gives all twelve words, in order. Paste them into the first cue, or type them one by one.
          </Direction>
          <CueGrid values={cues} onChange={setCues} />
          {!status.hasPassword ? (
            <div className={styles.row}>
              <div className={styles.rowText}>
                <div className={styles.rowLabel}>Remember this computer</div>
                <div className={styles.rowHint}>Next time it opens without asking. Only while no password is set.</div>
              </div>
              <Toggle on={remember} onChange={setRemember} label="Remember" />
            </div>
          ) : null}
          {problem ? <StageNote label="Line flub" tone="flub">{problem}</StageNote> : null}
          <StageActions cta="Take the stage" onCta={() => void enter()} disabled={busy || cues.some((c) => !c)}>
            {status.hasPassword ? <GhostButton onClick={() => { setWithLines(false); setProblem(null); }}>Use my password instead</GhostButton> : null}
          </StageActions>
        </Dossier>
      </Stage>
    );
  }

  return (
    <Stage>
      <Dossier act="The stage door" title="Welcome" accent="back">
        <Direction>The house is locked. Speak the password and the lights come up.</Direction>
        <SecretField id="door-password" label="Password" value={password} onChange={setPassword} onEnter={() => password && void enter()} invalid={problem !== null} />
        {problem ? <StageNote label="Line flub" tone="flub">{problem}</StageNote> : null}
        <StageActions cta="Enter stage right" onCta={() => void enter()} disabled={busy || !password}>
          {status.hasWords ? <GhostButton onClick={() => { setWithLines(true); setProblem(null); }}>I forgot it: use my lines</GhostButton> : null}
        </StageActions>
      </Dossier>
    </Stage>
  );
}

/** The load-in: the pieces carried into the library, checked as they arrive. */
function LoadIn({ status }: { status: Status }): JSX.Element {
  const done = status.done ?? 0;
  const total = status.total ?? 0;
  const recent = status.recent ?? [];
  return (
    <Stage>
      <Dossier act="Load-in" title="Moving" accent="in">
        <Direction>The company carries every piece into the locked library and checks each one on arrival. The folder is only read.</Direction>
        <Lines heading="On the loading dock">
          <pre className={styles.proof}>{recent.length ? recent.map((f, i) => `${i === recent.length - 1 && done < total ? "carrying" : "checked "} ${f}`).join("\n") : "opening the library"}</pre>
          <div className={styles.count}>{total ? `${done} / ${total} pieces carried in` : " "}</div>
        </Lines>
        <p className={styles.subtle}>Closing Bunzai now is safe: nothing is kept half done, and it starts over next time.</p>
      </Dossier>
    </Stage>
  );
}

/** Done: how many came across, and any piece kept under a new name. */
function AllAboard({ copied, onGo }: { copied: NonNullable<Status["copied"]>; onGo: () => void }): JSX.Element {
  return (
    <Stage>
      <Dossier act="Load-in" title="All" accent="aboard" hero>
        <Voice>{`${copied.files} ${copied.files === 1 ? "piece" : "pieces"} carried in and checked.`}</Voice>
        {copied.leftInFolder > 0 ? (
          <Direction>{`Pictures, exports, and other files, ${copied.leftInFolder} in all, stay in the folder as they were. The library keeps each piece's picture inside the piece.`}</Direction>
        ) : null}
        {copied.renamed.length > 0 ? (
          <>
            <Lines heading="Renamed to keep both">
              <ol className={styles.subtle}>
                {copied.renamed.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (r) => (
                  <li key={r.to}>{`${r.from} kept as ${r.to}`}</li>
                ))}
              </ol>
            </Lines>
            <p className={styles.subtle}>Two names that differ only in capitals are one name in the library, so the second got a number.</p>
          </>
        ) : null}
        <StageActions cta="Take the stage" onCta={onGo} />
      </Dossier>
    </Stage>
  );
}

/** The copy could not run (too little room); the folder stays in use, unencrypted, until it can. */
function NoRoom({ reason }: { reason: string }): JSX.Element {
  const [restarting, setRestarting] = useState(false);
  const retry = async (): Promise<void> => {
    setRestarting(true);
    try {
      await post("/api/restart", {});
    } catch {
      /* the server is going down to restart: the reload below brings the page back with it */
    }
    window.setTimeout(() => window.location.reload(), 2500);
  };
  return (
    <Stage>
      <Dossier act="Load-in" title="No room" accent="backstage">
        <StageNote label="Stage direction" tone="warn">{`${reason}. Nothing was changed.`}</StageNote>
        <StageActions cta={restarting ? "Restarting" : "Try again"} onCta={() => void retry()} disabled={restarting} />
      </Dossier>
    </Stage>
  );
}

/**
 * True exactly when a status read crosses INTO locked from something else this window already knew
 * about: the idle-lock poll's own moment of discovery, and a lock from elsewhere (another window, a
 * remote client) discovered the same way. This is the ONE other place besides a 423 mid-request
 * that a lock is learned about without this window causing it, so it is the one other place that
 * must raise LIBRARY_LOCKED_EVENT - every decrypted object URL the art cache holds
 * (`_shared/art-cache.ts`) must be revoked the moment the library it came from is locked, not just
 * on the next request that happens to fail.
 */
export function entersLocked(prev: Status | null, next: Status): boolean {
  return next.phase === "locked" && prev?.phase !== "locked";
}

export function LibraryGate({ children, pieces: injectedPieces }: { children: ReactNode; pieces?: PieceStore }): JSX.Element | null {
  const [pieces] = useState(() => injectedPieces ?? new PieceStore());
  useStudioChangeStream(pieces);
  const [status, setStatus] = useState<Status | null>(null);
  const [, setDismissed] = useState(0);

  const check = useCallback(async (): Promise<void> => {
    let next: Status;
    try {
      next = await apiFetchJson<Status>("/api/library/status", { requireToken: false });
    } catch (e) {
      next = statusOnError(e);
    }
    setStatus(next);
  }, []);

  // Entering "locked" (a pushed lock, or a 423 from this window's own call) raises the lock event, so the art
  // cache revokes every decrypted object URL. In an effect, not a state updater: updaters must stay
  // pure (StrictMode runs them twice).
  const lastStatus = useRef<Status | null>(null);
  useEffect(() => {
    if (status && entersLocked(lastStatus.current, status)) {
      if (!pieces.isLocked()) pieces.setLock("locked");
      window.dispatchEvent(new Event(LIBRARY_LOCKED_EVENT));
    } else if (status?.phase === "unlocked" && lastStatus.current?.phase === "locked" && pieces.isLocked()) pieces.setLock("unlocked");
    lastStatus.current = status;
  }, [status, pieces]);

  useEffect(() => {
    void check();
    const onLocked = (): void => void check();
    window.addEventListener(LIBRARY_LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(LIBRARY_LOCKED_EVENT, onLocked);
  }, [check]);

  // Every registered plaintext client cache (src/ui/_shared/caches.ts: token, keyword-regex,
  // key-index, art) is cleared on the same event, in one place.
  useEffect(() => attachCacheLockListener(window), []);

  // Host-only (routes.ts): a remote or LAN session never reaches this stream and `watching` stays
  // false forever, which the fallback poll below covers. Called unconditionally (not just once
  // unlocked) so a lock or unlock reached from elsewhere - Kit, another tab - is seen on the stage
  // door too, not only after the Studio has already mounted.
  const { watching, lockEvent } = useStudioChanges(pieces);
  useEffect(() => {
    if (lockEvent) void check();
  }, [lockEvent, check]);
  // A RECONNECT MEANS A GAP, AND THE GAP HAD A LOCK OR UNLOCK IN IT (same reasoning as
  // use-studio-changes.ts's own version bump on reconnect). The stream carries no replay: a push
  // that landed while this tab slept, or while the connection was briefly down, reached nobody.
  // Sleep/wake is the concrete case - the deadline fires while the machine is asleep, then
  // EventSource reconnects seconds later - so this also re-checks on the tab becoming visible,
  // which does not wait on `watching` at all.
  const wasWatching = useRef(watching);
  useEffect(() => {
    if (watching && !wasWatching.current) void check();
    wasWatching.current = watching;
  }, [watching, check]);
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  // Locked: nothing to poll for; a push (above) or this window's own 423 (LIBRARY_LOCKED_EVENT,
  // effect above) are the only ways out. Opening/loading-in: the load-in screen's progress moves
  // on this. Failed: the server may come back on its own.
  const phase = status?.phase;
  const openingOrFailed = !phase || phase === "locked" || phase === "unlocked" ? null : phase === "failed" ? 5_000 : 400;
  useVisibleInterval(() => void check(), openingOrFailed);
  // Unlocked: pushed lock/unlock events (above) are the primary signal; this is only the fallback
  // for a session the stream cannot reach at all.
  useVisibleInterval(() => void check(), phase === "unlocked" && !watching ? 15_000 : null);

  if (!status) return null;
  const go = (key: string) => (): void => {
    markSeen(key);
    setDismissed((n) => n + 1);
  };
  switch (gateScreen(status, { loadInSeen: seen(SEEN_LOAD_IN) })) {
    case "load-in":
      return <LoadIn status={status} />;
    case "stage-door":
      return <StageDoor status={status} />;
    case "failed":
      return (
        <Stage>
          <Dossier act="The stage door" title="The house" accent="is dark">
            <StageNote label="Line flub" tone="flub">{`The library could not open: ${status.reason ?? "an unknown error"}. Your studio folder was not changed.`}</StageNote>
            <StageActions cta="Try again" onCta={() => void check()}>
              <p className={styles.subtle}>If this keeps happening, close Bunzai and open it again.</p>
            </StageActions>
          </Dossier>
        </Stage>
      );
    case "no-room":
      return <NoRoom reason={status.reason ?? "there is not enough room to import the library"} />;
    case "all-aboard":
      return <AllAboard copied={status.copied!} onGo={go(SEEN_LOAD_IN)} />;
    case "studio":
      return <>{children}</>;
  }
}
