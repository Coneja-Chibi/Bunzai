/** Generated docs navigation and catalog search for the reader's left rail. */
import { ListRow, Segmented } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { Panel } from "../../components/panel";
import { useEffect, useState, type JSX } from "react";
import type { DocRecord } from "../../docs-types";
import { displayDocTitle, groupDocs, searchDocs } from "./docs-core";
import styles from "./styles.module.css";

interface DocNavProps {
  docs: DocRecord[];
  activeId: string;
  query: string;
  onQuery(value: string): void;
  onPick(id: string): void;
}

export function DocNav({ docs, activeId, query, onQuery, onPick }: DocNavProps): JSX.Element {
  const groups = groupDocs(searchDocs(docs, query));
  const activeGroup = groupDocs(docs).find((group) =>
    group.sections.some((section) => section.docs.some((doc) => doc.id === activeId)))?.id ?? "user";
  const [shelf, setShelf] = useState<"user" | "developer">(activeGroup);
  useEffect(() => setShelf(activeGroup), [activeGroup]);
  const visibleGroups = query.trim() ? groups : groups.filter((group) => group.id === shelf);

  return (
    <Panel as="div" deck="lorebook" data-part="docs.nav" className={styles.nav}>
    <nav aria-label="Documentation">
      <label className={styles.searchField}>
        <Ic name="lucide:search" size={18} />
        <input
          className={styles.search}
          placeholder="search the docs"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          aria-label="Search the docs"
          data-tour="search"
        />
      </label>
      {!query.trim() && (
        <div className={styles.shelves}>
          <Segmented
            label="Documentation audience"
            items={groupDocs(docs).map((group) => ({ value: group.id, label: group.label }))}
            value={shelf}
            onChange={setShelf}
          />
        </div>
      )}
      {visibleGroups.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (group) => (
        <section className={styles.group} key={group.id} aria-label={group.label}>
          {query.trim() && <h2 className={styles.groupTitle}>{group.label}</h2>}
          {group.sections.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (section, index) => (
            <details
              className={styles.section}
              key={`${group.id}-${section.id}-${shelf}`}
              open={Boolean(query.trim()) || index === 0 || section.docs.some((doc) => doc.id === activeId)}
            >
              <summary className={styles.grp}>{section.label} <span className={styles.count}>{section.docs.length}</span></summary>
              {section.docs.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (doc) => (
                <div className={styles.docRow} key={doc.id} data-part={`docs.nav.row.${doc.id}`}>
                  <ListRow
                    selected={doc.id === activeId}
                    aria-current={doc.id === activeId ? "page" : undefined}
                    onClick={() => onPick(doc.id)}
                    label={displayDocTitle(doc)}
                  />
                </div>
              ))}
            </details>
          ))}
        </section>
      ))}
      {groups.length === 0 && (
        <div className={styles.moment}>
          <h2 className={styles.momentTitle}>Nothing on that page</h2>
          <p>No docs match that search.</p>
        </div>
      )}
    </nav>
    </Panel>
  );
}
