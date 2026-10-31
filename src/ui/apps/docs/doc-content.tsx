/** Center reader pane: safe Markdown segments, trusted docs assets, and gated GitHub links. */
import { Button } from "../../components/button";
import { useEffect, useMemo, type JSX } from "react";
import type { DocFigure, DocRecord } from "../../docs-types";
import { requestExternal } from "../../_shared/link-gate";
import { docAssetUrl } from "../../_shared/asset-url";
import { Panel } from "../../components/panel";
import { RenderBox } from "../../components/render-box";
import { displayDocTitle, prepareDocSegments, targetFromAppHref } from "./docs-core";
import styles from "./styles.module.css";

interface DocContentProps {
  doc: DocRecord;
  docs: DocRecord[];
  figures: DocFigure[];
  body: string;
  anchor: string;
  loading: boolean;
  onPick(id: string, anchor?: string): void;
}

export function DocContent({ doc, docs, figures, body, anchor, loading, onPick }: DocContentProps): JSX.Element {
  const segments = useMemo(() => prepareDocSegments(body, doc, docs, figures), [body, doc, docs, figures]);

  useEffect(() => {
    if (!anchor || loading) return;
    // Cancelled on unmount so a scroll queued for a page that has gone never runs against a missing document.
    const frame = requestAnimationFrame(() => document.getElementById(`doc-${anchor}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [anchor, loading, body]);

  const onLinkClick = (href: string): boolean => {
    const target = targetFromAppHref(href);
    if (!target || !docs.some((candidate) => candidate.id === target.id)) return false;
    onPick(target.id, target.anchor);
    return true;
  };

  const openGitHub = (): void => {
    requestExternal(`https://github.com/Vaudeville-Studios/Bunzai/blob/Mainstage/${doc.path}`, `View ${doc.title} on GitHub`);
  };

  return (
    <Panel as="div" role="main" deck="character" data-part="docs.article" className={styles.main} data-tour="content">
      <div className={styles.inner}>
        <div className={styles.crumb}>
          <span>{doc.audience === "user" ? "User Docs" : "Developer Docs"} / {displayDocTitle(doc)}</span>
          <span className={styles.github}><Button size="sm" variant="quiet" onClick={openGitHub}>View on GitHub</Button></span>
        </div>
        <span className={styles.audience} data-audience={doc.audience}>{doc.audience}</span>
        {loading ? <div className={styles.moment}><span className={styles.pulse} /><h2 className={styles.momentTitle}>Opening the page…</h2></div> : (
          <article className={styles.prose}>
            {segments.map((segment, index) => segment.kind === "markdown" ? (
              <RenderBox
                key={`copy-${index}`}
                value={segment.body}
                format="markdown"
                displayOnly
                onLinkClick={onLinkClick}
              />
            ) : (
              <figure className={styles.figure} key={`${segment.path}-${index}`}>
                <img
                  src={docAssetUrl(segment.path)}
                  alt={segment.alt}
                  width={segment.width}
                  height={segment.height}
                  loading="lazy"
                />
                {segment.caption && <figcaption>{segment.caption}</figcaption>}
              </figure>
            ))}
          </article>
        )}
      </div>
    </Panel>
  );
}
