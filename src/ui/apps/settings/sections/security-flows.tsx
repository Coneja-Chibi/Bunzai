/**
 * The Security dialogs, from the approved in-between wireframes (design/wireframes/encryption/
 * in-between/02-the-key.html and 03-opening-lines.html): the opening lines (shown once, then typed
 * back in the audition), the key (lines first, then the password with its strength meter and when
 * to ask), the rehearsal, and the fresh proof ("Is it you?") any change asks for while a password is
 * set. Each dialog is a dossier over the scrim.
 */
import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiStatusIs } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";
import { InkDialog } from "../../../components/ink-dialog";
import { CueGrid, Direction, Dossier, GhostButton, Lines, Pledge, SecretField, StageActions, StageNote, WordList } from "../../../components/stage-dossier";
import { SegControl } from "../section-contract";
import { securityApi, type LockPolicy } from "./security-api";
import styles from "./security.module.css";

const TWELVE = (): string[] => Array.from({ length: 12 }, () => "");
/** A refusal, named the way the wireframes name them: a theatrical label, then one plain sentence. */
type Problem = { label: string; text: string };
const flub = (text: string): Problem => ({ label: "Line flub", text });
/** The server's sentences are lower case fragments; on screen they read as sentences. */
export const sentence = (text: string): string => {
  const t = text.trim();
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
};
const problemOf = (e: unknown): Problem => {
  const text = sentence(toErrorMessage(e, "something went wrong"));
  if (apiStatusIs(e, 503)) return { label: "No room in the wings", text };
  if (apiStatusIs(e, 409)) return { label: /only way into/i.test(text) ? "The only way in" : "Missed cue", text };
  return flub(text);
};

function Sheet({ label, onDismiss, children }: { label: string; onDismiss: () => void; children: ReactNode }): JSX.Element {
  return (
    <InkDialog ariaLabel={label} onDismiss={onDismiss} sheetClassName={styles.sheet}>
      {children}
    </InkDialog>
  );
}

/**
 * Runs a change; when the server answers that a fresh proof is needed (428), asks "Is it you?" in
 * place of the flow and then runs the change again. A failure of that second run comes back to the
 * flow through `onError`, so a full disk or a change in another window after the proof is shown,
 * never lost with the proof dialog.
 */
function useProof(hasPassword: boolean, onError: (e: unknown) => void) {
  const [retry, setRetry] = useState<null | (() => Promise<void>)>(null);
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (e) {
      if (!apiStatusIs(e, 428)) throw e;
      setRetry(() => action);
    }
  };
  const view = retry ? (
    <ProveBody
      hasPassword={hasPassword}
      onProved={async () => {
        const again = retry;
        setRetry(null);
        try {
          await again();
        } catch (e) {
          onError(e);
        }
      }}
    />
  ) : null;
  return { run, view };
}

/** "Is it you?": the password, or the lines instead. */
function ProveBody({ hasPassword, onProved }: { hasPassword: boolean; onProved: () => Promise<void> }): JSX.Element {
  const [useLines, setUseLines] = useState(!hasPassword);
  const [password, setPassword] = useState("");
  const [cues, setCues] = useState(TWELVE);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = useLines ? cues.every((c) => c) : password !== "";
  const submit = async (): Promise<void> => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (useLines) await securityApi.proveWithWords(cues);
      else await securityApi.proveWithPassword(password);
    } catch (e) {
      setProblem(apiStatusIs(e, 401) ? flub(useLines ? "Those lines do not open this library. Check your script." : "That password does not open this library.") : problemOf(e));
      setBusy(false);
      return;
    }
    setBusy(false);
    await onProved();
  };
  return (
    <Dossier act="Stage manager" title="Is it" accent="you?">
      <Direction>Changing the password, the lines, or the remembered computers needs the password or your lines. You will not be asked again for five minutes.</Direction>
      {useLines ? (
        <CueGrid values={cues} onChange={setCues} />
      ) : (
        <SecretField id="prove-password" label="Current password" value={password} onChange={setPassword} onEnter={() => void submit()} />
      )}
      {problem ? <StageNote label={problem.label} tone="flub">{problem.text}</StageNote> : null}
      <StageActions cta="It is me" onCta={() => void submit()} disabled={busy || !ready}>
        {hasPassword ? <GhostButton onClick={() => setUseLines(!useLines)}>{useLines ? "Use my password instead" : "Use my lines instead"}</GhostButton> : null}
      </StageActions>
    </Dossier>
  );
}

/** The script, for the printer only: the words and nothing else. */
function PrintedScript({ words }: { words: readonly string[] }): JSX.Element {
  return createPortal(
    <div className={`${styles.script} host-protected`}>
      <h1>Bunraku recovery words</h1>
      <p>Spoken in order, these open your library on any computer. Keep this page somewhere safe.</p>
      <ol>
        {words.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ol>
    </div>,
    document.body,
  );
}

/** Act 0 shows the words once; Act 1 is the audition, where they are typed back. */
export function OpeningLines({ hasPassword, onDone, onCancel }: { hasPassword: boolean; onDone: () => void; onCancel: () => void }): JSX.Element {
  const [words, setWords] = useState<string[] | null>(null);
  const [act, setAct] = useState<0 | 1>(0);
  const [pledged, setPledged] = useState(false);
  const [cues, setCues] = useState(TWELVE);
  const [flubbed, setFlubbed] = useState<number[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const proof = useProof(hasPassword, (e) => setProblem(problemOf(e)));

  useEffect(() => {
    let alive = true;
    securityApi.beginWords().then(
      (r) => alive && setWords(r.words),
      (e: unknown) => alive && setProblem(problemOf(e)),
    );
    return () => {
      alive = false;
    };
  }, []);

  const audition = async (): Promise<void> => {
    if (!words) return;
    const off = cues.map((c, i) => (c === words[i] ? -1 : i)).filter((i) => i >= 0);
    setFlubbed(off);
    if (off.length > 0) {
      setProblem(flub(off.length === 1 ? `Cue ${off[0]! + 1} is off. Check your script.` : `Cues ${off.map((i) => i + 1).join(", ")} are off. Check your script.`));
      return;
    }
    setProblem(null);
    try {
      await proof.run(async () => {
        await securityApi.confirmWords(cues);
        onDone();
      });
    } catch (e) {
      setProblem(problemOf(e));
    }
  };

  let body: JSX.Element;
  if (proof.view) body = proof.view;
  else if (!words) {
    body = (
      <Dossier act="Act 0, Prologue" title="Your opening" accent="lines">
        {problem ? <StageNote label={problem.label} tone="flub">{problem.text}</StageNote> : <Direction>The lines are being written.</Direction>}
        <StageActions cta="Close" onCta={onCancel} />
      </Dossier>
    );
  } else if (act === 0) {
    body = (
      <Dossier act="Act 0, Prologue" title="Your opening" accent="lines">
        <Direction>
          The <b>PLAYER</b> is presented with twelve words. Spoken in order, they open this library on any computer, even when every other key is lost.
        </Direction>
        <Lines heading="Your lines">
          <WordList words={words} />
        </Lines>
        <StageNote label="Stage direction" tone="warn">
          Lose these lines, and the show cannot go on. Bunraku keeps no copy it can show you again, and nobody can prompt you.
        </StageNote>
        <GhostButton onClick={() => window.print()}>Print the script</GhostButton>
        <Pledge checked={pledged} onChange={setPledged}>
          {"“I have written down my lines and stored them somewhere safe, lest they be forgotten.”"}
        </Pledge>
        <StageActions cta="On to the audition" onCta={() => setAct(1)} disabled={!pledged}>
          <GhostButton onClick={onCancel}>Not tonight</GhostButton>
        </StageActions>
        <PrintedScript words={words} />
      </Dossier>
    );
  } else {
    body = (
      <Dossier act="Act 1, The Audition" title="Recite your" accent="lines">
        <Direction>Your old lines, if you had any, keep working until these are confirmed.</Direction>
        <CueGrid values={cues} onChange={setCues} flubbed={flubbed} />
        {problem ? <StageNote label={problem.label} tone="flub">{problem.text}</StageNote> : null}
        <StageActions cta="Take the stage" onCta={() => void audition()} disabled={cues.some((c) => !c)}>
          <GhostButton onClick={onCancel}>Not tonight</GhostButton>
        </StageActions>
      </Dossier>
    );
  }
  return (
    <Sheet label="Your opening lines" onDismiss={onCancel}>
      {body}
    </Sheet>
  );
}

type Strength = { score: 0 | 1 | 2 | 3 | 4 };
type StrengthModule = { passwordStrength: (password: string) => Strength };
/** The meter's own bundle, fetched once, only when a password is being chosen (its dictionaries are large). */
let strengthModule: Promise<StrengthModule> | null = null;
const STRENGTH_URL = "/vendor/strength.js";
const loadStrength = (): Promise<StrengthModule> => (strengthModule ??= import(/* @vite-ignore */ STRENGTH_URL) as Promise<StrengthModule>);

const METER_WORDS = ["Very weak. This could be guessed at once.", "Weak. A few unrelated words make a better key.", "Fair. Another word would help.", "Strong. A few unrelated words make a good key.", "Very strong."];

function StrengthMeter({ password }: { password: string }): JSX.Element {
  const [score, setScore] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    if (!password) {
      setScore(null);
      return;
    }
    loadStrength().then(
      (m) => alive && setScore(m.passwordStrength(password).score),
      () => alive && setScore(null),
    );
    return () => {
      alive = false;
    };
  }, [password]);
  const lit = score === null ? 0 : Math.max(1, score);
  const litClass = score !== null && score >= 3 ? styles.strongLit : styles.weakLit;
  return (
    <div>
      <div className={styles.meter} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < lit ? litClass : undefined} />
        ))}
      </div>
      <div className={styles.meterWords} aria-live="polite">
        {score === null ? " " : METER_WORDS[score]}
      </div>
    </div>
  );
}

/** Act II, the key: the password, typed twice, and when the door asks for it. Lines come first. */
export function TheKey({
  hasWords,
  hasPassword,
  onWriteLines,
  onDone,
  onCancel,
}: {
  hasWords: boolean;
  hasPassword: boolean;
  onWriteLines: () => void;
  onDone: () => void;
  onCancel: () => void;
}): JSX.Element {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [idle, setIdle] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const proof = useProof(hasPassword, (e) => setProblem(problemOf(e)));

  const lockTheDoor = async (): Promise<void> => {
    if (password !== again) {
      setProblem(flub("The two passwords do not match."));
      return;
    }
    setBusy(true);
    setProblem(null);
    const policy: LockPolicy = idle ? { mode: "idle", idleMinutes: 15 } : { mode: "each-open" };
    try {
      await proof.run(async () => {
        await securityApi.setPassword(password, policy);
        onDone();
      });
    } catch (e) {
      setProblem(problemOf(e));
    } finally {
      setBusy(false);
    }
  };

  let body: JSX.Element;
  if (proof.view) body = proof.view;
  else if (!hasWords) {
    body = (
      <Dossier act="Before the key" title="Lines" accent="first">
        <StageNote label="Stage direction" tone="warn">
          A password you forget would lock the stage door for good. Your twelve lines are the way back in, so they are written first. It takes about a minute.
        </StageNote>
        <StageActions cta="Write my opening lines" onCta={onWriteLines}>
          <GhostButton onClick={onCancel}>Not tonight</GhostButton>
        </StageActions>
      </Dossier>
    );
  } else {
    body = (
      <Dossier act="Act II, The Key" title="A key for the" accent="door">
        <Direction>Once set, every computer forgets its own key and the door asks for this one.</Direction>
        <SecretField id="new-password" label="New password" value={password} onChange={setPassword} />
        <StrengthMeter password={password} />
        <SecretField id="again-password" label="Say it again" value={again} onChange={setAgain} onEnter={() => void lockTheDoor()} />
        <div className={styles.field}>
          <label>When the door asks</label>
          <div className={styles.hint}>Each time the app opens, and also after you step away if you choose.</div>
          <SegControl
            options={[
              { value: "each-open", label: "Each open" },
              { value: "idle", label: "Also after 15 min idle" },
            ]}
            current={idle ? "idle" : "each-open"}
            onPick={(v) => setIdle(v === "idle")}
          />
        </div>
        {problem ? <StageNote label={problem.label} tone="flub">{problem.text}</StageNote> : null}
        <StageActions cta="Lock the door" onCta={() => void lockTheDoor()} disabled={busy || !password || !again}>
          <GhostButton onClick={onCancel}>Not tonight</GhostButton>
        </StageActions>
      </Dossier>
    );
  }
  return (
    <Sheet label="A key for the stage door" onDismiss={onCancel}>
      {body}
    </Sheet>
  );
}

/** The occasional rehearsal: all twelve words, since no single word is stored. */
export function Rehearsal({ due, onWriteNew, onDone, onCancel }: { due: boolean; onWriteNew: () => void; onDone: () => void; onCancel: () => void }): JSX.Element {
  const [cues, setCues] = useState(TWELVE);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      await securityApi.rehearse(cues);
      onDone();
    } catch (e) {
      setProblem(apiStatusIs(e, 401) ? flub("Those lines do not match. Check your script, or write new lines.") : problemOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet label="Rehearsal" onDismiss={onCancel}>
      <Dossier act="Rehearsal" title="Still know your" accent="lines?">
        <Direction>{`${due ? "Three months since the last run-through. " : ""}Bunraku stores no single word, so the whole script is asked for.`}</Direction>
        <CueGrid values={cues} onChange={setCues} />
        {problem ? <StageNote label={problem.label} tone="flub">{problem.text}</StageNote> : null}
        <StageActions cta="Run my lines" onCta={() => void run()} disabled={busy || cues.some((c) => !c)}>
          <GhostButton onClick={onCancel}>Not tonight</GhostButton>
          <GhostButton onClick={onWriteNew}>Write new lines</GhostButton>
        </StageActions>
      </Dossier>
    </Sheet>
  );
}

/** A change that only needs the fresh proof (removing the password, forgetting a computer). */
export function ProveThen({ hasPassword, label, action, onDone, onCancel }: { hasPassword: boolean; label: string; action: () => Promise<unknown>; onDone: () => void; onCancel: () => void }): JSX.Element {
  const [problem, setProblem] = useState<Problem | null>(null);
  const proof = useProof(hasPassword, (e) => setProblem(problemOf(e)));
  useEffect(() => {
    let alive = true;
    proof
      .run(async () => {
        await action();
        if (alive) onDone();
      })
      .catch((e: unknown) => alive && setProblem(problemOf(e)));
    return () => {
      alive = false;
    };
    // Runs once: the action is what this dialog was opened for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Sheet label={label} onDismiss={onCancel}>
      {proof.view ?? (
        <Dossier act="Stage manager" title={label}>
          {problem ? <StageNote label={problem.label} tone="flub">{problem.text}</StageNote> : <Direction>One moment.</Direction>}
          <StageActions cta="Close" onCta={onCancel} />
        </Dossier>
      )}
    </Sheet>
  );
}

/** "Recast": forgetting another computer asks first, then goes through the fresh proof. */
export function Recast({ label, hasPassword, onForget, onDone, onCancel }: { label: string; hasPassword: boolean; onForget: () => Promise<unknown>; onDone: () => void; onCancel: () => void }): JSX.Element {
  const [sure, setSure] = useState(false);
  if (sure) return <ProveThen hasPassword={hasPassword} label={`Forget ${label}`} action={onForget} onDone={onDone} onCancel={onCancel} />;
  return (
    <Sheet label={`Forget ${label}`} onDismiss={onCancel}>
      <Dossier act="Recast" title="Forget" accent={`${label}?`}>
        <Direction>It will no longer open the library by itself. To open it there again, you will need your lines.</Direction>
        <StageActions cta="Forget it" onCta={() => setSure(true)}>
          <GhostButton onClick={onCancel}>Keep it</GhostButton>
        </StageActions>
      </Dossier>
    </Sheet>
  );
}
