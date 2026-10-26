/**
 * The title screen. The behavior lives in use-title.ts; the look is the theme's shell.title pick: the velvet
 * premiere proscenium here (the approved theater look and the fallback), or one of the variants beside it.
 */
import { Button, Card } from "../components/button";
import type { CSSProperties, JSX } from "react";
import { LightRays } from "../components/light-rays";
import { docAssetUrl } from "../_shared/asset-url";
import { api } from "../api";
import { SceneArt } from "../_shared/scene-art";
import { Proscenium } from "../components/proscenium";
import { Ic } from "../_shared/ic";
import { useSurfaceVariant } from "../_shared/surface-variant";
import { ThemeSlot } from "../_shared/theme-slot";
import type { PieceStore } from "../_shared/piece-store";
import type { SceneSummary } from "../../studio/scenes";
import styles from "./title-screen.module.css";
import AttractTitle from "./variants/shell.title/attract";
import StickerSplashTitle from "./variants/shell.title/sticker-splash";
import TitlePageTitle from "./variants/shell.title/title-page";
import { useTitle, type TitleState } from "./use-title";

export interface TitleScreenProps {
  onDone: (appId?: string) => void;
  listScenes?: () => Promise<SceneSummary[]>;
  pieces?: PieceStore;
}

function ProsceniumTitle({ state, pieces }: { state: TitleState; pieces?: PieceStore }): JSX.Element {
  const { sheetRef, closing, recent, sceneState, enter, continueStory, importPiece, startStory, browseStories } = state;
  return (
    <section ref={sheetRef} tabIndex={-1} data-part="shell.title" aria-label="Bunraku title screen" className={`${styles.stage} ${closing ? styles.closing : ""}`}>
      <div className={styles.scene} style={{
        "--theater-wide": `url("${docAssetUrl("docs/media/velvet-premiere-wide-unlit.png")}")`,
        "--theater-tablet": `url("${docAssetUrl("docs/media/velvet-premiere-tablet-unlit.png")}")`,
        "--theater-phone": `url("${docAssetUrl("docs/media/velvet-premiere-phone-unlit.png")}")`,
      } as CSSProperties}>
        <div className={styles.art} aria-hidden="true" />
        <LightRays />
        <div className={styles.marquee}>
          <div className={styles.kicker}>The velvet premiere</div>
          <h1 className={styles.word}>Bun<em>raku</em></h1>
          <p className={styles.tag}>Every story deserves a stage.</p>
          <div className={styles.actions}>
            <Button variant="primary" disabled={closing} onClick={enter}>Enter the theater</Button>
            <Button disabled={closing} onClick={continueStory}>Continue your story</Button>
          </div>
          <div className={styles.importLink}><Button variant="quiet" size="sm" disabled={closing} onClick={importPiece}>Have a character or world already? Bring it in →</Button></div>
        </div>
        <div className={styles.floor}>
          <Proscenium label="Now playing" art={recent && pieces ? <SceneArt ctx={{ pieces }} chatId={recent.id} characterId={recent.cast.character.id} snapshotVersion={recent.snapshotVersion} hasArt={recent.hasPortrait} name={recent.characterName} trimTop /> : <div className={styles.emptyScreen}><Ic name="lucide:film" /><span>Your next scene</span></div>}>
            <span className={styles.kicker}>{sceneState}</span>
            {recent ? <>
              <h2>{recent.title}</h2>
              <p>{recent.characterName} · {recent.messageCount} messages</p>
              <Button size="sm" disabled={closing} onClick={continueStory}>Return to scene</Button>
            </> : <>
              <h2>Your stories belong here.</h2>
              <p>Choose a character from your Library, or bring one in to begin.</p>
            </>}
          </Proscenium>
          <nav className={styles.quickStart} aria-label="Quick start">
            <div className={styles.quickHeading}><span className={styles.kicker}>Quick start</span><span>Three ways in</span></div>
            <div className={styles.tickets}>
              <Card kind="entry" aria-label="Start a story" heading="Start a story" subtitle="Choose a character" disabled={closing} onClick={startStory}><Ic name="lucide:drama" /><span className={styles.arrow} aria-hidden="true">→</span></Card>
              <Card kind="entry" aria-label="Import a piece" heading="Import a piece" subtitle="Bring a card or world" disabled={closing} onClick={importPiece}><Ic name="lucide:copy" /><span className={styles.arrow} aria-hidden="true">→</span></Card>
              <Card kind="entry" aria-label="Browse stories" heading="Browse stories" subtitle="Find another scene" disabled={closing} onClick={browseStories}><Ic name="lucide:film" /><span className={styles.arrow} aria-hidden="true">→</span></Card>
            </div>
          </nav>
        </div>
      </div>
      <footer className={styles.footer}>
        <span className={styles.note}>Scenes make<br />bolder people.</span>
        <span className={styles.premiere}>The velvet premiere</span>
        <span className={styles.note}>For braver stories.</span>
      </footer>
      <ThemeSlot id="shell.title.below" />
    </section>
  );
}

/** Resume the latest scene or use the existing Library, import and Scenes entry points. */
export function TitleScreen({ onDone, listScenes = api.listScenes, pieces }: TitleScreenProps): JSX.Element {
  const variant = useSurfaceVariant("shell.title");
  const state = useTitle(onDone, listScenes);
  if (variant === "attract") return <AttractTitle state={state} />;
  if (variant === "sticker-splash") return <StickerSplashTitle state={state} pieces={pieces} />;
  if (variant === "title-page") return <TitlePageTitle state={state} pieces={pieces} />;
  return <ProsceniumTitle state={state} pieces={pieces} />;
}
