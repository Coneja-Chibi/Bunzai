/**
 * Settings, Backups: the approved wireframe (design/wireframes/backups/index.html), in Security's
 * grammar (its hero, stat tiles, mono proof block, card rows, chips, ghost buttons) and its protected
 * restore dialog. Copies are made hourly while Bunraku is open; this screen
 * lists them, makes one now, and restores one after showing what would change. Over the host-only
 * routes (src/ui/server-library-care.ts); a remote or LAN device sees none of it.
 */
import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import type { SettingsSection } from "../section-contract";
import { SettingsRow } from "../section-contract";
import { StageNote } from "../../../components/stage-dossier";
import { toErrorMessage } from "../../../_shared/error-message";
import { ProtectedDialog } from "../../../_shared/protected-dialog";
import { agoLabel, backupsApi, dayLabel, keptWords, KIND_CHIP, removable, sizeLabel, whenLabel, type BackupsState, type Copy } from "./backups-core";
import { RestoreDialog } from "./backups-dialogs";
import { sentence } from "./security-flows";
import styles from "./security.module.css";
import { plural } from "../../../../core/text";

const SHOWN = 5;
const chipClass = (tone: "plain" | "ok" | "warn"): string | undefined => (tone === "ok" ? styles.chipOk : tone === "warn" ? styles.chipWarn : styles.chip);

/** Plain, checkable lines about what a copy does, and the things it does not do. */
export function proofLines(needsWords: boolean): { text: string; not?: boolean }[] {
  return [
    { text: "+ A copy is made every hour while Bunraku is open, with no pause in your work." },
    { text: "+ Copies are encrypted exactly like your library, so a stolen copy shows nothing." },
    needsWords
      ? { text: "- Until you write your lines (recovery words), a copy only opens on this computer.", not: true }
      : { text: "+ A copy opens on a new computer with your lines (recovery words)." },
    { text: "- Copies sit beside your library on this disk. They protect the file, not the machine.", not: true },
    { text: "- A copy made before you changed your password or lines still opens with the old ones.", not: true },
  ];
}

function Backups(): JSX.Element {
  const [state, setState] = useState<BackupsState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const [restoring, setRestoring] = useState<Copy | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setState(await backupsApi.state());
      setProblem(null);
    } catch (e) {
      setProblem(toErrorMessage(e, "could not read the copies"));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const makeOne = async (): Promise<void> => {
    setBusy(true);
    try {
      await backupsApi.take();
      setProblem(null);
    } catch (e) {
      setProblem(sentence(toErrorMessage(e, "the copy could not be made")));
    }
    setBusy(false);
    await refresh();
  };

  const remove = async (c: Copy): Promise<void> => {
    try {
      await backupsApi.remove(c.id);
      setProblem(null);
    } catch (e) {
      setProblem(sentence(toErrorMessage(e, "the copy could not be removed")));
    }
    await refresh();
  };

  if (!state) return <div className={problem ? styles.error : styles.subtle}>{problem ?? "Reading the copies..."}</div>;

  const shown = all ? state.snapshots : state.snapshots.slice(0, SHOWN);
  const total = state.snapshots.length;
  return (
    <div className={`${styles.wrap} host-protected`}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>{"Settings · Backups"}</div>
        <h2 className={styles.marquee}>
          Spare <em>copies</em>
        </h2>
        <p className={styles.voice}>Your library, copied while you work.</p>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Last copy</div>
          <div className={styles.tileValue}>{state.last ? agoLabel(state.last.takenAt) : "None yet"}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Copies kept</div>
          <div className={styles.tileValue}>{total === 0 ? "None yet" : `${plural(total, "copy", "copies")}, ${sizeLabel(state.totalBytes)}`}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Next copy</div>
          <div className={styles.tileValue}>Within the hour, if anything changed</div>
        </div>
      </div>

      <pre className={styles.proof}>
        {proofLines(state.needsWords).map((l, i) => (
          <span key={i} className={l.not ? styles.proofNot : undefined}>
            {`${l.text}\n`}
          </span>
        ))}
      </pre>

      {state.needsWords ? (
        <StageNote label="Stage direction: your lines" tone="warn">
          Copies already run. Until you write your lines, a copy can only be restored here, on this computer. Write them in Security.
        </StageNote>
      ) : null}
      {!state.unlocked ? (
        <StageNote label="Stage direction: locked" tone="warn">
          Copies carry on while the library is locked. To restore one, unlock the library first.
        </StageNote>
      ) : null}
      {problem || state.lastError ? (
        <div className={styles.card}>
          <StageNote label="No room in the wings" tone="flub">
            {sentence(problem ?? state.lastError ?? "")}
          </StageNote>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => void makeOne()}>
              Try again now
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <SettingsRow label="Back up now" hint="Makes a copy right away. Hourly copies carry on as usual.">
          <button type="button" className={styles.btn} disabled={busy} onClick={() => void makeOne()}>
            Back up now
          </button>
        </SettingsRow>
        <SettingsRow
          label="What is kept"
          hint={`${keptWords(state.manual, state.snapshots.filter((c) => c.kind === "before-restore").length)} Copies use ${sizeLabel(state.totalBytes)} of this disk.`}
        >
          <span />
        </SettingsRow>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Copies</div>
        {total === 0 ? <div className={styles.cardBody}>No copies yet. The first one is made shortly after Bunraku opens, or press Back up now.</div> : null}
        {shown.map((c) => (
          <div className={styles.pc} key={c.id}>
            <div>
              <div className={styles.pcName}>
                {whenLabel(c.takenAt)} <span className={chipClass(KIND_CHIP[c.kind].tone)}>{KIND_CHIP[c.kind].label}</span>
              </div>
              <div className={styles.pcMeta}>{`${dayLabel(c.takenAt)} · ${sizeLabel(c.bytes)}`}</div>
            </div>
            <div className={styles.actions}>
              {removable(c) ? (
                <button type="button" className={styles.btnGhost} title="Moves the copy to the trash folder beside the copies; nothing is deleted" onClick={() => void remove(c)}>
                  Remove
                </button>
              ) : null}
              <button type="button" className={styles.btnGhost} disabled={!state.unlocked} onClick={() => setRestoring(c)}>
                Restore
              </button>
            </div>
          </div>
        ))}
        {total > SHOWN ? (
          <>
            <p className={styles.subtle}>{`Showing the ${all ? "whole list" : `newest ${SHOWN}`} of ${total}. Newest first; a copy is named by when it was made.`}</p>
            <button type="button" className={styles.btnGhost} onClick={() => setAll(!all)}>
              {all ? "Show fewer" : "Show all copies"}
            </button>
          </>
        ) : null}
      </div>

      {restoring ? (
        <ProtectedDialog variant="card" ariaLabel="Restore a copy">
          <RestoreDialog
            copy={restoring}
            onClose={() => {
              setRestoring(null);
              void refresh();
            }}
            onUndo={(undo) => setRestoring(undo)}
          />
        </ProtectedDialog>
      ) : null}
    </div>
  );
}

const section: SettingsSection = { id: "backups", label: "Backups", order: 26, Component: Backups };
export default section;
