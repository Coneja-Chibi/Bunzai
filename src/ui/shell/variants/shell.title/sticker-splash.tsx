/**
 * shell.title sticker-splash: a scrapbook page. The wordmark is a big sticker, each way in is a square sticker in its
 * own pastel, and the newest scene is a pinned card. The same five ways out as every title variant.
 */
import type { JSX } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import type { PieceStore } from "../../../_shared/piece-store";
import { ThemeSlot } from "../../../_shared/theme-slot";
import RecentArt from "../../title-art";
import type { TitleState } from "../../use-title";
import styles from "./sticker-splash.module.css";

export default function StickerSplashTitle({ state, pieces }: { state: TitleState; pieces?: PieceStore }): JSX.Element {
  const { sheetRef, closing, recent, sceneState, enter, continueStory, importPiece, startStory, browseStories } = state;
  const stickers: [string, string, string, IconName, string, () => void][] = [
    ["start", "Start a story", "Choose a character", "lucide:drama", styles.pink!, startStory],
    ["import", "Import a piece", "Bring a card or world", "lucide:copy", styles.sky!, importPiece],
    ["browse", "Browse stories", "Find another scene", "lucide:film", styles.mint!, browseStories],
  ];
  return (
    <section ref={sheetRef} tabIndex={-1} data-part="shell.title" aria-label="Bunraku title screen" className={`${styles.stage}${closing ? ` ${styles.closing}` : ""}`}>
      <div className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.word}>Bunraku</h1>
          <p className={styles.tag}>Every story deserves a stage.</p>
          <div className={styles.go}>
            <button type="button" data-title-action="enter" className={styles.primary} disabled={closing} onClick={enter}>Enter the theater</button>
            <button type="button" data-title-action="continue" className={styles.secondary} disabled={closing} onClick={continueStory}>Continue your story</button>
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
                <button type="button" data-title-action="resume" className={styles.resume} disabled={closing} onClick={continueStory}>Return to scene</button>
              </>
            ) : (
              <>
                <h2 className={styles.title}>Your stories belong here.</h2>
                <p className={styles.meta}>Choose a character from your Library, or bring one in to begin.</p>
              </>
            )}
          </section>
          <nav className={styles.stickers} aria-label="Quick start">
            {stickers.map(([action, label, hint, icon, tone, run]) => (
              <button key={action} type="button" data-title-action={action} aria-label={label} className={`${styles.sticker} ${tone}`} disabled={closing} onClick={run}>
                <Ic name={icon} size={32} />
                <strong>{label}</strong>
                <small>{hint}</small>
              </button>
            ))}
          </nav>
        </div>
      </div>
      <ThemeSlot id="shell.title.below" />
    </section>
  );
}
