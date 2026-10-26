/**
 * The restore dialog of Settings, Backups (design/wireframes/backups/index.html, states 5 to 8): what
 * would change, then the swap, then Undo, or a plain refusal that says nothing was changed. There is no
 * "are you sure" gate: the undo copy the restore makes first is the safety. A dossier over the scrim, like
 * the Security dialogs.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { toErrorMessage } from "../../../_shared/error-message";
import { Direction, Dossier, GhostButton, StageActions, StageNote } from "../../../components/stage-dossier";
import { backupsApi, previewRows, refusalLabel, whenLabel, type Copy, type Preview, type Restored } from "./backups-core";
import { sentence } from "./security-flows";
import styles from "./security.module.css";

type Step = { at: "preview"; preview: Preview | null } | { at: "working" } | { at: "done"; result: Restored } | { at: "refused"; label: string; text: string };

/** Marks the open dialog, so the page's "restored" push lets this window show its Undo before it reloads. */
export const RESTORE_OPEN_ATTRIBUTE = "data-restore-open";

export function RestoreDialog({ copy, onClose, onUndo }: { copy: Copy; onClose: () => void; onUndo: (undo: Copy) => void }): JSX.Element {
  const [step, setStep] = useState<Step>({ at: "preview", preview: null });
  const when = whenLabel(copy.takenAt);
  const refuse = (e: unknown): void => {
    const text = sentence(toErrorMessage(e, "something went wrong"));
    setStep({ at: "refused", label: refusalLabel(text), text });
  };

  useEffect(() => {
    let alive = true;
    backupsApi.preview(copy.id).then(
      (preview) => alive && setStep({ at: "preview", preview }),
      (e: unknown) => alive && refuse(e),
    );
    return () => {
      alive = false;
    };
  }, [copy.id]);

  const restore = (): void => {
    setStep({ at: "working" });
    backupsApi.restore(copy.id).then((result) => setStep({ at: "done", result }), refuse);
  };
  const keep = (): void => window.location.reload();

  let body: JSX.Element;
  if (step.at === "working") {
    body = (
      <Dossier act="One moment" title="Changing the" accent="set">
        <div className={styles.status}>Saving your library as it is now (the undo copy), checking the copy opens with your key, then swapping it in. Saving new changes waits a moment.</div>
        <Direction>This can take a minute for a big library. You can leave this window open; the swap happens all at once, so it is either done or not started.</Direction>
      </Dossier>
    );
  } else if (step.at === "done") {
    body = (
      <Dossier act="Restored" title="Back to" accent={when}>
        <StageNote label="Stage direction: restored" tone="warn">
          {`Your library is back to ${when}. The page will reload to show it. If that was not what you wanted, you can undo it now or any time from the list.`}
        </StageNote>
        <StageNote label="Other programs" tone="warn">If Kit or another Bunraku window in another program is open on this library, restart it: it keeps its own copy of what it read before the restore.</StageNote>
        {step.result.sealOwed ? (
          <StageNote label="One thing left" tone="flub">{`Some rows are still waiting to be marked as checked (${step.result.sealOwed}). The next save will finish it.`}</StageNote>
        ) : null}
        <StageActions cta="Undo this restore" onCta={() => onUndo(step.result.undo)}>
          <GhostButton onClick={keep}>Keep it</GhostButton>
        </StageActions>
      </Dossier>
    );
  } else if (step.at === "refused") {
    body = (
      <Dossier act="Restore" title="Not" accent="restored">
        <StageNote label={step.label} tone="flub">{step.text}</StageNote>
        <StageActions cta="Close" onCta={onClose} />
      </Dossier>
    );
  } else {
    body = (
      <Dossier act="Restore" title="Back to" accent={`${when}?`}>
        <Direction>Your whole library goes back to how it was in this copy. Your password, your lines, and the computers that can open it stay exactly as they are.</Direction>
        {step.preview ? (
          <div className={styles.card}>
            {previewRows(step.preview).map(/* bounded-ok: fixed options, per-finding detail, or short word lists */ (row) => (
              <div className={styles.pc} key={row.name}>
                <div>
                  <div className={styles.pcName}>{row.name}</div>
                  <div className={styles.pcMeta}>{row.meta}</div>
                </div>
                <div className={styles.pcMeta}>{row.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <Direction>Comparing the copy with your library.</Direction>
        )}
        <StageNote label="Nothing is lost" tone="warn">
          First, Bunraku saves your library as it is right now as its own copy. Anything this restore sets aside is in that copy, and one button undoes the restore.
        </StageNote>
        <StageActions cta="Restore this copy" onCta={restore} disabled={step.preview === null}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
        </StageActions>
      </Dossier>
    );
  }
  // Inside the caller's ProtectedDialog (the top layer): a portaled sheet would sit under it.
  return <div {...{ [RESTORE_OPEN_ATTRIBUTE]: "" }}>{body}</div>;
}
