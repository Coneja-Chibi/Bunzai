/**
 * CSS Workshop room: head, actions, stage with shared CssWorkshop leaf, optional tour.
 * Mode (simple | advanced) is owned here and mirrored in the leaf toggle.
 */
import { Button } from "../../components/button";
import { useCallback, useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import {
  CssWorkshop,
  type CssSimpleTab,
  type CssWorkshopMode,
} from "../../components/css-workshop";
import { Panel } from "../../components/panel";
import { RoomHeader } from "../../components/room-header";
import { InkDialog } from "../../components/ink-dialog";
import { TourGuide } from "../../components/tour-guide";
import { hasSeenTour, tourSeenKey } from "../../tours/tour-core";
import { copyText } from "../../_shared/clipboard";
import { triggerDownload } from "../../components/export-dialog/download";
import "./variant-styles";
import {
  asPrefString,
  DEFAULT_PACK_ID,
  PREF_DRAFT,
  PREF_PACK,
  STARTER_CSS,
} from "./prefs";
import cssWorkshopTour from "./tour";
import styles from "./styles.module.css";

const NOTE =
  "Standalone draft. Bunraku never applies this to the app chrome. Copy or download to paste on Chub, Janitor, Risu, or anywhere that takes CSS. Card-bound CSS still lives on the piece in the Workbench.";

const PREF_MODE = "css-workshop.mode";

const asMode = (v: unknown): CssWorkshopMode => (v === "advanced" ? "advanced" : "simple");

export interface CssWorkshopRoomProps {
  ctx: AppContext;
}

/** Full app canvas for the CSS Workshop dock tile. */
export function CssWorkshopRoom({ ctx }: CssWorkshopRoomProps): JSX.Element {
  const [css, setCss] = useState(() => asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS));
  const [packId, setPackId] = useState(() =>
    asPrefString(ctx.prefs.get(PREF_PACK), DEFAULT_PACK_ID),
  );
  const [mode, setMode] = useState<CssWorkshopMode>(() => asMode(ctx.prefs.get(PREF_MODE)));
  const [simpleTab, setSimpleTab] = useState<CssSimpleTab>(() =>
    asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS).trim() === "" ? "starters" : "assist",
  );
  const [flash, setFlash] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    ctx.setStatus(mode === "advanced" ? "css workshop · advanced" : "css workshop · simple");
  }, [ctx, mode]);

  useEffect(() => {
    if (hasSeenTour(ctx.prefs.get(tourSeenKey("css-workshop")))) return;
    const t = window.setTimeout(() => setTourOpen(true), 400);
    return () => window.clearTimeout(t);
  }, [ctx]);

  const persist = useCallback(
    (next: string) => {
      setCss(next);
      ctx.prefs.set(PREF_DRAFT, next);
    },
    [ctx],
  );

  const persistPack = useCallback(
    (id: string) => {
      setPackId(id);
      ctx.prefs.set(PREF_PACK, id);
    },
    [ctx],
  );

  const persistMode = useCallback(
    (next: CssWorkshopMode) => {
      setMode(next);
      ctx.prefs.set(PREF_MODE, next);
    },
    [ctx],
  );

  const onCopy = async (): Promise<void> => {
    const ok = await copyText(css);
    setFlash(ok ? "copied plain CSS" : "copy failed - open Source and copy manually");
    ctx.setStatus(ok ? "css workshop · copied" : "css workshop · copy failed");
  };

  const onDownload = (): void => {
    const blob = new Blob([css], { type: "text/css;charset=utf-8" });
    triggerDownload(blob, "vaude-style.css");
    setFlash("downloaded vaude-style.css");
    ctx.setStatus("css workshop · downloaded");
  };

  const onClear = (): void => {
    setClearOpen(false);
    persist("");
    persistMode("simple");
    setSimpleTab("starters");
    setFlash("draft cleared");
    ctx.setStatus("css workshop · cleared");
  };

  return (
    <div className={styles.room} data-part="css-workshop.room">
      <RoomHeader
        data-part="css-workshop.head"
        kicker="App · style"
        title="CSS Workshop"
        lede="Simple mode is the guided ladder. Advanced is code plus rule breakdown. Flip anytime. Import a .css file to load it into Advanced."
        actions={
          <>
            <Button size="sm" variant="primary" onClick={() => void onCopy()}>
              Copy CSS
            </Button>
            <Button size="sm" onClick={onDownload}>
              Download .css
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setClearOpen(true)}>
              Clear draft
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setTourOpen(true)}>
              Tour
            </Button>
            {flash ? <span className={styles.flash}>{flash}</span> : null}
          </>
        }
      />

      <Panel data-part="css-workshop.stage" deck="regex" className={styles.stage}>
        <CssWorkshop
          value={css}
          onChange={persist}
          defaultPackId={packId}
          onPackChange={persistPack}
          note={NOTE}
          mode={mode}
          onModeChange={persistMode}
          simpleTab={simpleTab}
          onSimpleTabChange={setSimpleTab}
        />
      </Panel>
      {tourOpen && (
        <TourGuide tour={cssWorkshopTour} ctx={ctx} onClose={() => setTourOpen(false)} />
      )}

      {clearOpen && (
        <InkDialog onDismiss={() => setClearOpen(false)} ariaLabel="Clear the draft">
          <Panel as="div" data-part="css-workshop.clear" className={styles.clearSheet}>
            <b className={styles.clearTitle}>Clear the draft?</b>
            <p className={styles.clearBody}>Your unsaved CSS goes away.</p>
            <div className={styles.clearActs}>
              <Button variant="danger" onClick={onClear}>
                Clear
              </Button>
              <Button variant="quiet" onClick={() => setClearOpen(false)}>
                Keep
              </Button>
            </div>
          </Panel>
        </InkDialog>
      )}
    </div>
  );
}
