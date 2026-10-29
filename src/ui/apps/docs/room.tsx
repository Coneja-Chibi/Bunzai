/** Help / Docs room state: load the packaged corpus, remember a page, and compose its three panes. */
import { Button } from "../../components/button";
import { useEffect, useRef, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { DocFigure, DocRecord, DocsIndex } from "../../docs-types";
import { toErrorMessage } from "../../_shared/error-message";
import { BottomSheet } from "../../components/bottom-sheet";
import { RoomHeader } from "../../components/room-header";
import { DocContent } from "./doc-content";
import { DocNav } from "./doc-nav";
import { DocToc } from "./doc-toc";
import { displayDocTitle } from "./docs-core";
import styles from "./styles.module.css";

type MobilePanel = "browse" | "sections" | null;

export function DocsRoom({ ctx }: { ctx: AppContext }): JSX.Element {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const [docs, setDocs] = useState<DocRecord[] | null>(null);
  const [figures, setFigures] = useState<DocFigure[]>([]);
  const [activeId, setActiveId] = useState("");
  const [anchor, setAnchor] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetch("/api/docs/index"), fetch("/api/docs/figures")]).then(async ([indexRes, figuresRes]) => {
      if (!indexRes.ok || !figuresRes.ok) throw new Error("The packaged docs could not be opened.");
      const index = await indexRes.json() as DocsIndex;
      const loadedFigures = await figuresRes.json() as DocFigure[];
      if (cancelled) return;
      setDocs(index.docs);
      setFigures(loadedFigures);
      const remembered = ctxRef.current.prefs.get("docs.last");
      const landing = typeof remembered === "string" && index.docs.some((doc) => doc.id === remembered)
        ? remembered
        : index.docs.find((doc) => doc.id === "guide/getting-started")?.id ??
          index.docs.find((doc) => doc.audience === "user")?.id ?? index.docs[0]?.id ?? "";
      setActiveId(landing);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(toErrorMessage(reason, "The packaged docs could not be opened."));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/docs/get?id=${encodeURIComponent(activeId)}`).then(async (response) => {
      if (!response.ok) throw new Error("That docs page could not be opened.");
      const nextBody = await response.text();
      if (cancelled) return;
      setBody(nextBody);
      setLoading(false);
      ctxRef.current.prefs.set("docs.last", activeId);
      const doc = docs?.find((candidate) => candidate.id === activeId);
      if (doc) ctxRef.current.setStatus(`docs · ${doc.title}`);
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setLoading(false);
        setError(toErrorMessage(reason, "That docs page could not be opened."));
      }
    });
    return () => { cancelled = true; };
  }, [activeId, docs]);

  const pick = (id: string, nextAnchor = ""): void => {
    setAnchor(nextAnchor);
    if (id !== activeId) {
      setLoading(true);
      setBody("");
      setError(null);
    }
    setActiveId(id);
    if (id === activeId && nextAnchor) {
      document.getElementById(`doc-${nextAnchor}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (error) return <div className={`${styles.moment} ${styles.err}`}><h2 className={styles.momentTitle}>{error}</h2></div>;
  if (!docs || !activeId) return <div className={styles.moment}><span className={styles.pulse} /><h2 className={styles.momentTitle}>Opening Help / Docs…</h2></div>;
  const active = docs.find((doc) => doc.id === activeId) ?? docs[0]!;
  const mobilePick = (id: string, nextAnchor = ""): void => {
    pick(id, nextAnchor);
    setMobilePanel(null);
  };

  return (
    <div className={styles.host}>
      <RoomHeader
        data-part="docs.header"
        kicker="The program notes"
        title="Help / Docs"
        lede="The same documentation committed to GitHub, packaged into Bunzai so it is always close by."
      />
      <div className={styles.room}>
        <header className={styles.mobileHead}>
          <Button
            size="sm"
            aria-controls="docs-mobile-browse"
            aria-expanded={mobilePanel === "browse"}
            onClick={() => setMobilePanel("browse")}
          >
            Browse
          </Button>
          <span className={styles.mobileTitle}>
            <b>{displayDocTitle(active)}</b>
            <small>{active.audience === "user" ? "User docs" : "Developer docs"}</small>
          </span>
          <Button
            size="sm"
            aria-controls="docs-mobile-sections"
            aria-expanded={mobilePanel === "sections"}
            disabled={active.anchors.length === 0}
            onClick={() => setMobilePanel("sections")}
          >
            Sections
          </Button>
        </header>

        <div className={styles.desktopNav}>
          <DocNav docs={docs} activeId={active.id} query={query} onQuery={setQuery} onPick={pick} />
        </div>
        <DocContent
          doc={active}
          docs={docs}
          figures={figures}
          body={body}
          anchor={anchor}
          loading={loading}
          onPick={pick}
        />
        <div className={styles.desktopToc}>
          <DocToc anchors={active.anchors} activeSlug={anchor} onJump={(slug) => pick(active.id, slug)} />
        </div>

        {mobilePanel === "browse" && (
          <BottomSheet title="Browse docs" ariaLabel="Browse documentation" onDismiss={() => setMobilePanel(null)}>
            <div id="docs-mobile-browse" className={styles.mobileSheet}>
              <DocNav docs={docs} activeId={active.id} query={query} onQuery={setQuery} onPick={mobilePick} />
            </div>
          </BottomSheet>
        )}
        {mobilePanel === "sections" && (
          <BottomSheet title="On this page" onDismiss={() => setMobilePanel(null)}>
            <div id="docs-mobile-sections" className={styles.mobileSheet}>
              <DocToc anchors={active.anchors} activeSlug={anchor} onJump={(slug) => mobilePick(active.id, slug)} />
            </div>
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
