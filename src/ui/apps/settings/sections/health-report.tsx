/**
 * Settings, Security, "Check my library": the report of the approved wireframe (design/wireframes/
 * health-check/index.html). Checking (with a stop), all well, damage found as one list of plain-worded
 * notices each offering its repairs, the preview before a set-aside, the result of a repair (re-checked),
 * and a check that could not finish. Nothing changes until a person confirms one repair, every repair sets
 * things aside and never deletes, and no backup is asked for first.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { toErrorMessage } from "../../../_shared/error-message";
import { ProtectedDialog } from "../../../_shared/protected-dialog";
import { Direction, Dossier, GhostButton, StageActions, StageNote } from "../../../components/stage-dossier";
import { backupsApi, sizeLabel, whenLabel, type Copy } from "./backups-core";
import { allWell, chipOf, healthApi, isDanger, repairButton, stoppedWords, type Finding, type RepairKind, type RepairOutcome, type ScanJob } from "./health-core";
import { RESTORE_OPEN_ATTRIBUTE } from "./backups-dialogs";
import { sentence } from "./security-flows";
import { Button } from "../../../components/button";
import styles from "./security.module.css";

type Done = Extract<ScanJob, { state: "done" }>;
type Asking = null | { set: Finding; summary: string } | { restore: Finding; copies: Copy[] };

function Notice({ finding, busy, onRepair }: { finding: Finding; busy: boolean; onRepair: (kind: RepairKind) => void }): JSX.Element {
  return (
    <div className={isDanger(finding.code) ? `${styles.notice} ${styles.noticeDanger}` : styles.notice}>
      <div>
        <div className={styles.noticeTitle}>
          <span className={styles.chipWarn}>{chipOf(finding.code)}</span> {sentence(finding.item)}
        </div>
        <p className={styles.noticeBody}>{sentence(finding.cause)}</p>
      </div>
      <div className={styles.actions}>
        {finding.repairs.map((kind) => {
          const b = repairButton(kind, finding);
          return (
            <Button key={kind} size="sm" variant={b.primary ? "primary" : "secondary"} disabled={busy} onClick={() => onRepair(kind)}>
              {b.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** The Check my library card: nothing until asked, then the job's state. */
export function HealthReport(): JSX.Element {
  const [job, setJob] = useState<ScanJob>({ state: "none" });
  const [asking, setAsking] = useState<Asking>(null);
  const [outcome, setOutcome] = useState<RepairOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  /** A restore replaced the whole library, so this page's copies of it are stale until it reloads. */
  const [reload, setReload] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (): Promise<void> => {
    try {
      const next = await healthApi.job();
      setJob(next);
      if (next.state === "running") timer.current = setTimeout(() => void poll(), 400); // a scan in progress; cleared on unmount
    } catch (e) {
      setProblem(toErrorMessage(e, "could not read the check"));
    }
  }, []);
  useEffect(() => {
    void poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  const run = async (work: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (e) {
      setProblem(sentence(toErrorMessage(e, "that did not work")));
    }
    setBusy(false);
  };
  const check = (): Promise<void> =>
    run(async () => {
      setOutcome(null);
      setJob(await healthApi.start());
      await poll();
    });
  const repair = (finding: Finding, kind: RepairKind, snapshotId?: string): Promise<void> =>
    run(async () => {
      // A restore keeps its dialog open until it is done: the page's reload push waits for it (backups-dialogs.tsx).
      if (kind !== "restore-snapshot") setAsking(null);
      try {
        setOutcome(await healthApi.repair(finding.id, kind, snapshotId));
        if (kind === "restore-snapshot") setReload(true);
      } finally {
        setAsking(null);
      }
      await poll();
    });
  const ask = (finding: Finding, kind: RepairKind): void => {
    if (kind === "set-aside") {
      void run(async () => setAsking({ set: finding, summary: (await healthApi.preview(finding.id)).summary }));
    } else if (kind === "restore-snapshot") {
      void run(async () => setAsking({ restore: finding, copies: (await backupsApi.state()).snapshots.filter((c) => c.kind !== "before-restore").slice(0, 8) }));
    } else void repair(finding, kind);
  };

  let body: JSX.Element;
  if (job.state === "running") {
    const lit = Math.min(4, Math.ceil((job.done / Math.max(1, job.total)) * 4));
    body = (
      <>
        <div className={styles.cardTitle}>Checking your library</div>
        <div className={styles.cardBody}>Looking at your chats, then your characters and lorebooks. You can keep working.</div>
        <div className={styles.meter} role="progressbar" aria-valuenow={lit} aria-valuemin={0} aria-valuemax={4}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < lit ? styles.strongLit : undefined} />
          ))}
        </div>
        <div className={styles.status}>{`${job.done} of ${job.total} parts looked at`}</div>
        <div className={styles.actions}>
          <Button size="sm" onClick={() => void healthApi.stop()}>
            Stop
          </Button>
        </div>
      </>
    );
  } else if (job.state === "done") {
    body = <Report job={job} busy={busy} onCheck={() => void check()} onRepair={ask} />;
  } else {
    body = (
      <>
        <div className={styles.cardTitle}>Check my library</div>
        <div className={styles.cardBody}>
          {job.state === "failed" ? sentence(job.error) : "Opens every saved piece and chat and compares it with what was saved. Nothing changes until you confirm a repair, and a repair sets things aside, never deletes. No backup is needed first."}
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void check()}>
            Check my library
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.card}>{body}</div>
      {outcome ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span className={outcome.cleared ? styles.chipOk : styles.chipWarn}>{outcome.cleared ? "Done" : "Not finished"}</span> {outcome.cleared ? "Repaired" : "Still reported"}
          </div>
          <div className={styles.cardBody}>{sentence(outcome.summary)}</div>
          {reload ? (
            <div className={styles.actions}>
              <Button size="sm" variant="primary" onClick={() => window.location.reload()}>
                Reload to show it
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {problem ? <div className={styles.error}>{problem}</div> : null}
      {asking ? (
        <ProtectedDialog variant="card" ariaLabel="Check my library">
            {"set" in asking ? (
              <Dossier act="Set aside" title="Set this" accent="aside?">
                  <Direction>{`${sentence(asking.summary)} Set aside, not deleted: the copy is kept for good and is never purged.`}</Direction>
                <StageActions cta="Set aside" onCta={() => void repair(asking.set, "set-aside")}>
                  <GhostButton onClick={() => setAsking(null)}>Cancel</GhostButton>
                </StageActions>
              </Dossier>
            ) : (
              <div {...{ [RESTORE_OPEN_ATTRIBUTE]: "" }}>
                <Dossier act="Restore" title="Choose a" accent="snapshot">
                  <Direction>The whole library goes back to the copy you pick. A copy of how things are now is kept first, so this can be undone.</Direction>
                  {asking.copies.length === 0 ? <StageNote label="No copies yet" tone="warn">There is no copy to restore from yet.</StageNote> : null}
                  {asking.copies.map((c) => (
                    <div className={styles.pc} key={c.id}>
                      <div>
                        <div className={styles.pcName}>{whenLabel(c.takenAt)}</div>
                        <div className={styles.pcMeta}>{sizeLabel(c.bytes)}</div>
                      </div>
                      <Button size="sm" disabled={busy} onClick={() => void repair(asking.restore, "restore-snapshot", c.id)}>
                        Restore
                      </Button>
                    </div>
                  ))}
                  <StageActions cta="Cancel" onCta={() => setAsking(null)} />
                </Dossier>
              </div>
            )}
        </ProtectedDialog>
      ) : null}
    </>
  );
}

function Report({ job, busy, onCheck, onRepair }: { job: Done; busy: boolean; onCheck: () => void; onRepair: (f: Finding, kind: RepairKind) => void }): JSX.Element {
  if (!job.complete) {
    return (
      <div className={styles.notice}>
        <div>
          <div className={styles.noticeTitle}>{stoppedWords(job.stoppedAt)}</div>
          <p className={styles.noticeBody}>The check did not finish, so this is not a clean result. If the library locked, unlock it and check again.</p>
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="primary" disabled={busy} onClick={onCheck}>
            Check again
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      {job.sealOwed ? (
        <StageNote label="One thing left" tone="warn">{`Some rows are still waiting to be marked as checked after a restore (${job.sealOwed}). The next save will finish it.`}</StageNote>
      ) : null}
      {job.findings.length === 0 ? (
        <>
          <div className={styles.cardTitle}>
            <span className={styles.chipOk}>All well</span> Nothing is damaged
          </div>
          <div className={styles.cardBody}>{allWell(job)}</div>
        </>
      ) : (
        <>
          <div className={styles.cardTitle}>{`${job.findings.length} ${job.findings.length === 1 ? "item needs" : "items need"} a look`}</div>
          {job.findings.map((f) => (
            <Notice key={f.id} finding={f} busy={busy} onRepair={(kind) => onRepair(f, kind)} />
          ))}
        </>
      )}
      <div className={styles.actions}>
        <Button size="sm" disabled={busy} onClick={onCheck}>
          Check again
        </Button>
      </div>
    </>
  );
}
