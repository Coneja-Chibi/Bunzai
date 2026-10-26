/**
 * shell.title attract: an arcade attract screen. A wordmark over a segmented bar, a vertical menu with a cursor,
 * and the newest scene shown as a save slot. The same five ways out as every title variant.
 */
import type { JSX } from "react";
import type { TitleState } from "../../use-title";
import { Button, Card } from "../../../components/button";
import { ThemeSlot } from "../../../_shared/theme-slot";
import styles from "./attract.module.css";

export default function AttractTitle({ state }: { state: TitleState }): JSX.Element {
  const { sheetRef, closing, recent, sceneState, enter, continueStory, importPiece, startStory, browseStories } = state;
  const menu: [string, string, () => void][] = [
    ["enter", "Start", enter], ["continue", "Continue your story", continueStory], ["start", "Start a story", startStory],
    ["import", "Import a piece", importPiece], ["browse", "Browse stories", browseStories],
  ];
  return (
    <section ref={sheetRef} tabIndex={-1} data-part="shell.title" aria-label="Bunraku title screen" className={`${styles.stage}${closing ? ` ${styles.closing}` : ""}`}>
      <div className={styles.frame}>
        <header className={styles.head}>
          <h1 className={styles.word}>Bunraku</h1>
          <div className={styles.bar} aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <span key={i} />)}</div>
          <p className={styles.tag}>Every story deserves a stage.</p>
        </header>
        <div className={styles.body}>
          <nav className={styles.menu} aria-label="Main menu">
            {menu.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ([action, label, run], i) => (
              <Card key={action} kind="entry" data-title-action={action} heading={label} disabled={closing} onClick={run}>
                <span className={styles.cursor} aria-hidden="true" />
                <span className={styles.slot} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              </Card>
            ))}
          </nav>
          <section className={styles.save} aria-label="Last save">
            <div className={styles.saveHead}><span>Slot 01</span><span>{sceneState}</span></div>
            {recent ? (
              <>
                <h2 className={styles.saveName}>{recent.title}</h2>
                <dl className={styles.stats}>
                  <div><dt>Cast</dt><dd>{recent.characterName}</dd></div>
                  <div><dt>Messages</dt><dd>{recent.messageCount}</dd></div>
                </dl>
                <div className={styles.load}><Button size="sm" data-title-action="resume" disabled={closing} onClick={continueStory}>Return to scene</Button></div>
              </>
            ) : <p className={styles.empty}>No save data yet. Start a story to fill the first slot.</p>}
          </section>
        </div>
        <footer className={styles.keys}><span><kbd>Enter</kbd> Start</span><span><kbd>Tab</kbd> Move</span></footer>
      </div>
      <ThemeSlot id="shell.title.below" />
    </section>
  );
}
