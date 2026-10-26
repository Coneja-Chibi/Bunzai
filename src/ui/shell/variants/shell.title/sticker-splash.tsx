/**
 * shell.title sticker-splash: a scrapbook page. The wordmark is a big sticker, each way in is a square sticker in its
 * own pastel, and the newest scene is a pinned card. The same five ways out as every title variant.
 */
import type { JSX } from "react";
import { Button, Card } from "../../../components/button";
import { Ic, type IconName } from "../../../_shared/ic";
import type { PieceStore } from "../../../_shared/piece-store";
import { ThemeSlot } from "../../../_shared/theme-slot";
import RecentArt from "../../title-art";
import type { TitleState } from "../../use-title";
import styles from "./sticker-splash.module.css";

export default function StickerSplashTitle({ state, pieces }: { state: TitleState; pieces?: PieceStore }): JSX.Element {
  const { sheetRef, closing, recent, sceneState, enter, continueStory, importPiece, startStory, browseStories } = state;
  const stickers: [string, string, string, IconName, string, () => void][] = [
    ["start", "Start a story", "Choose a character", "lucide:drama", "var(--bk-role-brand)", startStory],
    ["import", "Import a piece", "Bring a card or world", "lucide:copy", "var(--bk-role-action)", importPiece],
    ["browse", "Browse stories", "Find another scene", "lucide:film", "var(--bk-role-ok)", browseStories],
  ];
  return (
    <section ref={sheetRef} tabIndex={-1} data-part="shell.title" aria-label="Bunraku title screen" className={`${styles.stage}${closing ? ` ${styles.closing}` : ""}`}>
      <div className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.word}>Bunraku</h1>
          <p className={styles.tag}>Every story deserves a stage.</p>
          <div className={styles.go}>
            <Button variant="primary" data-title-action="enter" disabled={closing} onClick={enter}>Enter the theater</Button>
            <Button data-title-action="continue" disabled={closing} onClick={continueStory}>Continue your story</Button>
          </div>
        </header>
        <div className={styles.board}>
          <section className={styles.pinned} aria-label="Now playing">
            <span className={styles.pin}>{sceneState}</span>
            <div className={styles.art}>{recent ? <RecentArt recent={recent} pieces={pieces} /> : <Ic name="lucide:film" size={40} />}</div>
            {recent ? (
              <>
                <h2 className={styles.title}>{recent.title}</h2>
                <p className={styles.meta}>{recent.characterName} · {recent.messageCount} messages</p>
                <div className={styles.resume}><Button size="sm" data-title-action="resume" disabled={closing} onClick={continueStory}>Return to scene</Button></div>
              </>
            ) : (
              <>
                <h2 className={styles.title}>Your stories belong here.</h2>
                <p className={styles.meta}>Choose a character from your Library, or bring one in to begin.</p>
              </>
            )}
          </section>
          <nav className={styles.stickers} aria-label="Quick start">
            {stickers.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ([action, label, hint, icon, tone, run]) => (
              <Card key={action} kind="entry" data-title-action={action} aria-label={label} heading={label} subtitle={hint} vars={{ "--sticker-tone": tone }} disabled={closing} onClick={run}>
                <Ic name={icon} size={32} />
              </Card>
            ))}
          </nav>
        </div>
      </div>
      <ThemeSlot id="shell.title.below" />
    </section>
  );
}
