/**
 * shell.title title-page: the opening leaf of a book. A running head, the title, a rule, then a table of
 * contents whose entries are the five ways in and a colophon for the scene last read.
 */
import type { JSX } from "react";
import type { PieceStore } from "../../../_shared/piece-store";
import { Button, Card } from "../../../components/button";
import { ThemeSlot } from "../../../_shared/theme-slot";
import RecentArt from "../../title-art";
import type { TitleState } from "../../use-title";
import styles from "./title-page.module.css";

export default function TitlePageTitle({ state, pieces }: { state: TitleState; pieces?: PieceStore }): JSX.Element {
  const { sheetRef, closing, recent, sceneState, enter, continueStory, importPiece, startStory, browseStories } = state;
  const contents: [string, string, string, () => void][] = [
    ["enter", "Enter the theater", "i", enter], ["continue", "Continue your story", "ii", continueStory], ["start", "Start a story", "iii", startStory],
    ["import", "Import a piece", "iv", importPiece], ["browse", "Browse stories", "v", browseStories],
  ];
  return (
    <section ref={sheetRef} tabIndex={-1} data-part="shell.title" aria-label="Bunraku title screen" className={`${styles.stage}${closing ? ` ${styles.closing}` : ""}`}>
      <article className={styles.leaf}>
        <p className={styles.runner}>A story engine</p>
        <h1 className={styles.title}>Bunraku</h1>
        <p className={styles.tag}>Every story deserves a stage.</p>
        <p className={styles.fleuron} aria-hidden="true">* * *</p>
        <nav aria-label="Contents">
          <h2 className={styles.contents}>Contents</h2>
          <ol className={styles.toc}>
            {contents.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ([action, label, folio, run]) => (
              <li key={action}>
                <Card kind="entry" data-title-action={action} heading={label} disabled={closing} onClick={run}>
                  <span className={styles.leader} aria-hidden="true" />
                  <span className={styles.folio} aria-hidden="true">{folio}</span>
                </Card>
              </li>
            ))}
          </ol>
        </nav>
        <aside className={styles.colophon} aria-label="Last read">
          <h2 className={styles.contents}>{recent ? "Last read" : sceneState}</h2>
          {recent ? (
            <div className={styles.read}>
              <div className={styles.plate}><RecentArt recent={recent} pieces={pieces} /></div>
              <div>
                <p className={styles.readTitle}>{recent.title}</p>
                <p className={styles.readMeta}>{recent.characterName}, {recent.messageCount} messages</p>
                <Button size="sm" data-title-action="resume" disabled={closing} onClick={continueStory}>Return to scene</Button>
              </div>
            </div>
          ) : <p className={styles.readMeta}>Choose a character from your Library, or bring one in to begin.</p>}
        </aside>
        <p className={styles.foot}>Press Enter to begin.</p>
      </article>
      <ThemeSlot id="shell.title.below" />
    </section>
  );
}
