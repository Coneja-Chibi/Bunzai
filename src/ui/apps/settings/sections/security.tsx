/**
 * Settings, Security: the approved in-between wireframe (design/wireframes/encryption/in-between/
 * 04-security-desk.html). The design system's hero and stat tiles, the mono proof block (what the
 * encryption does, and the one thing it does not), then the rows: the password, the opening lines,
 * the other computers (only when there are any), and Lock now. Every change goes through the
 * library's host-only routes (src/ui/server-library.ts); a remote or LAN device sees none of it.
 */
import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import type { SettingsSection } from "../section-contract";
import { SettingsRow } from "../section-contract";
import { Direction, Dossier, GhostButton, StageNote } from "../../../components/stage-dossier";
import { toErrorMessage } from "../../../_shared/error-message";
import { ProtectedDialog } from "../../../_shared/protected-dialog";
import { HealthReport } from "./health-report";
import { OpeningLines, ProveThen, Recast, Rehearsal, TheKey } from "./security-flows";
import { lockName, longDate, REHEARSAL_DUE_MS, shortDate, securityApi, type LibraryStatus, type RememberedComputer } from "./security-api";
import { Button } from "../../../components/button";
import styles from "./security.module.css";

type Dialog = null | "lines" | "key" | "key-after-lines" | "rehearse" | "remove-password" | { forget: RememberedComputer };

/** Plain, checkable lines about what the encryption does, and the one thing it does not. */
export function proofLines(s: LibraryStatus): { text: string; not?: boolean }[] {
  const lock = s.deviceLock ? lockName(s.deviceLock.lock) : null;
  const lines: { text: string; not?: boolean }[] = [{ text: "+ Everything you make is stored encrypted." }];
  if (s.hasPassword) {
    lines.push({ text: "+ The library asks for your password before it opens." });
    lines.push({ text: "+ A stolen disk shows nothing without the password or your lines." });
  } else {
    if (lock) lines.push({ text: `+ This computer opens it by itself, through ${lock === "A key file" ? "a key file in your home folder" : lock}.` });
    lines.push({ text: `+ A stolen disk shows nothing without this computer${s.hasWords ? " or your lines" : ""}.` });
    lines.push({ text: "- Anyone using this computer as you can open it. Add a password to stop that.", not: true });
  }
  if (s.deviceLock?.weak) lines.push({ text: "- The key file protects a copied library, not a whole stolen disk.", not: true });
  return lines;
}

function Security(): JSX.Element {
  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [computers, setComputers] = useState<RememberedComputer[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  /** A one-line result from an action taken on the page itself (the lock move, a cleanup retry). */
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const s = await securityApi.status();
      setStatus(s);
      setComputers(s.phase === "unlocked" ? await securityApi.computers() : []);
      setProblem(null);
    } catch (e) {
      setProblem(toErrorMessage(e, "could not read the library's security"));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const close = (): void => {
    setDialog(null);
    void refresh();
  };

  if (problem) return <div className={styles.error}>{problem}</div>;
  if (!status) return <div className={styles.subtle}>Reading the library...</div>;
  if (status.phase !== "unlocked") {
    return (
      <div className={`${styles.wrap} host-protected`}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Security</div>
          <div className={styles.cardBody}>
            {status.phase === "failed"
              ? "The library could not open, so there is nothing to lock yet."
              : "The library is not open. Security settings appear once it is."}
          </div>
        </div>
      </div>
    );
  }

  const hasWords = status.hasWords === true;
  const hasPassword = status.hasPassword === true;
  const others = computers.filter((c) => !c.thisComputer);
  const lastRun = status.wordsRehearsedAt ?? status.wordsWrittenAt ?? null;
  const rehearsalDue = hasWords && lastRun !== null && Date.now() - lastRun > REHEARSAL_DUE_MS;
  const askWhen = status.lockPolicy?.mode === "idle" ? `Each open, and after ${status.lockPolicy.idleMinutes} min idle` : "Each time the app opens";

  return (
    <div className={`${styles.wrap} host-protected`}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>{"Settings · Security"}</div>
        <h2 className={styles.marquee}>
          The stage <em>door</em>
        </h2>
        <p className={styles.voice}>Who gets in, and how.</p>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>The lock on this computer</div>
          <div className={styles.tileValue}>{hasPassword ? "Your password" : status.deviceLock ? lockName(status.deviceLock.lock) : "None"}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Password</div>
          <div className={styles.tileValue}>{hasPassword ? "On" : "Off"}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Your lines</div>
          <div className={styles.tileValue}>{hasWords && status.wordsWrittenAt ? `Written ${shortDate(status.wordsWrittenAt)}` : "Not written yet"}</div>
        </div>
      </div>

      <pre className={styles.proof}>
        {proofLines(status).map(/* bounded-ok: fixed options, per-finding detail, or short word lists */ (l, i) => (
          <span key={i} className={l.not ? styles.proofNot : undefined}>
            {`${l.text}\n`}
          </span>
        ))}
      </pre>

      {status.deviceLock?.weak && !hasPassword ? (
        <div className={styles.card}>
          <StageNote label="Stage direction: a weak lock" tone="warn">
            {`No system keychain was available, so this computer's key sits in a file beside your library. Someone who copies both can open it.${status.deviceLock.strongerAvailable ? " A stronger lock is available now." : ""}`}
          </StageNote>
          <div className={styles.actions}>
            {status.deviceLock.strongerAvailable ? (
              <Button size="sm" variant="primary" onClick={() => void securityApi.upgradeDeviceLock().then(refresh, (e: unknown) => setNotice(toErrorMessage(e, "could not move the lock")))}>
                Move to the stronger lock
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setDialog("key")}>
              Set a password instead
            </Button>
          </div>
        </div>
      ) : null}

      {status.cleanupPending ? (
        <Dossier act="After the change" title="Striking the" accent="set">
          <Direction>{`The old key is still being cleared from the library file (${status.cleanupPending}). Bunraku will try again in the background.`}</Direction>
          <GhostButton onClick={() => void securityApi.retryCleanup().then(refresh, (e: unknown) => setNotice(toErrorMessage(e, "could not try again")))}>Try again now</GhostButton>
        </Dossier>
      ) : null}
      {notice ? <div className={styles.error}>{notice}</div> : null}

      {rehearsalDue ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Still know your lines?</div>
          <div className={styles.cardBody}>Three months since the last run-through. Bunraku stores no single word, so the whole script is asked for.</div>
          <div className={styles.actions}>
            <Button size="sm" onClick={() => setDialog("rehearse")}>
              Run my lines
            </Button>
            <Button size="sm" onClick={() => setDialog("lines")}>
              Write new lines
            </Button>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <SettingsRow label="Password" hint={hasPassword ? `On. ${askWhen}.` : "Off. This computer opens your library by itself."}>
          <div className={styles.actions}>
            <Button size="sm" onClick={() => setDialog("key")}>
              {hasPassword ? "Change it" : "Set a password"}
            </Button>
            {hasPassword ? (
              <Button size="sm" variant="danger" onClick={() => setDialog("remove-password")}>
                Remove
              </Button>
            ) : null}
          </div>
        </SettingsRow>
        <SettingsRow
          label="Your lines (recovery words)"
          hint={
            hasWords && status.wordsWrittenAt
              ? `Written ${longDate(status.wordsWrittenAt)}. Last rehearsed ${longDate(lastRun ?? status.wordsWrittenAt)}.`
              : "Not written yet. Twelve words that open your library on any computer."
          }
        >
          <div className={styles.actions}>
            {hasWords ? (
              <>
                <Button size="sm" onClick={() => setDialog("rehearse")}>
                  Rehearse
                </Button>
                <Button size="sm" onClick={() => setDialog("lines")}>
                  Write new lines
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setDialog("lines")}>
                Write my opening lines
              </Button>
            )}
          </div>
        </SettingsRow>
        {hasPassword ? (
          <SettingsRow label="Lock now" hint="Closes the stage door until the password or your lines are given.">
            <Button size="sm" onClick={() => void securityApi.lock().then(() => window.location.reload(), (e: unknown) => setNotice(toErrorMessage(e, "could not lock")))}>
              Lock now
            </Button>
          </SettingsRow>
        ) : null}
      </div>

      <HealthReport />

      {others.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Other computers</div>
          <div className={styles.cardBody}>
            This library has also been opened on another computer, from a copied folder or a restored backup. Each one below can still open it by itself.
          </div>
          {others.map(/* bounded-ok: fixed category set, per-item detail, capped or short by construction */ (c) => (
            <div className={styles.pc} key={c.id}>
              <div>
                <div className={styles.pcName}>{c.label}</div>
                <div className={styles.pcMeta}>{`Since ${longDate(c.createdAt)} / ${lockName(c.lock)}`}</div>
              </div>
              <Button size="sm" variant="danger" onClick={() => setDialog({ forget: c })}>
                Forget
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {/* the recovery words, the key and the proofs are protected prompts: the top layer, not a block in this page */}
      {dialog !== null ? (
        <ProtectedDialog variant="card" ariaLabel="Security">
          {dialog === "lines" || dialog === "key-after-lines" ? (
            <OpeningLines
              hasPassword={hasPassword}
              onCancel={close}
              onDone={() => {
                if (dialog === "key-after-lines") {
                  void refresh().then(() => setDialog("key"));
                } else close();
              }}
            />
          ) : null}
          {dialog === "key" ? (
            <TheKey hasWords={hasWords} hasPassword={hasPassword} onWriteLines={() => setDialog("key-after-lines")} onDone={close} onCancel={close} />
          ) : null}
          {dialog === "rehearse" ? <Rehearsal due={rehearsalDue} onWriteNew={() => setDialog("lines")} onDone={close} onCancel={close} /> : null}
          {dialog === "remove-password" ? (
            <ProveThen hasPassword={hasPassword} label="Remove the password" action={() => securityApi.removePassword()} onDone={close} onCancel={close} />
          ) : null}
          {dialog !== null && typeof dialog === "object" ? (
            <Recast label={dialog.forget.label} hasPassword={hasPassword} onForget={() => securityApi.forgetComputer(dialog.forget.id)} onDone={close} onCancel={close} />
          ) : null}
        </ProtectedDialog>
      ) : null}
    </div>
  );
}

const section: SettingsSection = { id: "security", label: "Security", order: 25, Component: Security };
export default section;
