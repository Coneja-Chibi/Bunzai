/**
 * Health pane: inspectBook findings grouped by rule, Fix All with rescan proof (vs-lore-health).
 */
import { Button, IconButton, ListRow } from "../../../components/button";
import { useMemo, type JSX, type ReactNode } from "react";
import { VirtualRows } from "../../../_shared/virtual-list";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import {
  applyAllFixes,
  inspectBook,
  type LoreFinding,
  type LoreFindingRule,
} from "../../../../core/lore";
import styles from "./health-pane.module.css";

const RULE_TITLE: Record<LoreFindingRule, string> = {
  "broken-data": "Broken data",
  "broken-numbering": "Broken numbering",
  "duplicate-key": "Duplicate keys",
  "chance-contradiction": "Chance contradiction",
  "legacy-leftovers": "Legacy leftovers",
  "key-points-nowhere": "Keys that point nowhere",
  "wakes-itself": "Wakes itself",
  "never-woken": "Never woken by others",
  "never-fires": "Never fires",
};

const RULE_ORDER: LoreFindingRule[] = [
  "broken-data",
  "chance-contradiction",
  "never-fires",
  "wakes-itself",
  "broken-numbering",
  "duplicate-key",
  "key-points-nowhere",
  "never-woken",
  "legacy-leftovers",
];

/** One line of the windowed pane: a rule's heading or one of its findings. The edge says which border of the rule's box the line closes. */
type HealthRow = { key: string; edge: "top" | "mid" | "bottom"; node: ReactNode };
const ROW_ESTIMATE_PX = 40;

export interface HealthPaneProps {
  body: LorebookBody;
  onTransform: (fn: (b: LorebookBody) => LorebookBody) => void;
  onJumpEntry: (entryId: string) => void;
  onClose: () => void;
  /** Import heal notes (and similar) merged into the first scan. */
  extraFindings?: readonly LoreFinding[];
}

export function HealthPane({
  body,
  onTransform,
  onJumpEntry,
  onClose,
  extraFindings = [],
}: HealthPaneProps): JSX.Element {
  const findings = useMemo(
    () => [...inspectBook(body), ...extraFindings],
    [body, extraFindings],
  );

  const groups = useMemo(() => {
    const map = new Map<LoreFindingRule, LoreFinding[]>();
    for (const f of findings) {
      const list = map.get(f.rule) ?? [];
      list.push(f);
      map.set(f.rule, list);
    }
    return RULE_ORDER.filter((r) => map.has(r)).map((rule) => ({
      rule,
      items: map.get(rule)!,
      fixable: map.get(rule)!.every((f) => f.fix),
      severity: map.get(rule)!.some((f) => f.severity === "problem")
        ? ("problem" as const)
        : ("worth-a-look" as const),
    }));
  }, [findings]);

  const rows: HealthRow[] = groups.flatMap((g): HealthRow[] => [
    { key: `head:${g.rule}`, edge: "top", node: (
      <div className={styles.ghead}>
        <span className={g.severity === "problem" ? styles.chipBad : styles.chipWarn}>
          {g.severity === "problem" ? "Problem" : "Worth a look"}
        </span>
        <b>
          {RULE_TITLE[g.rule]} · {g.items.length}
        </b>
        {g.fixable ? (
          <Button size="sm" onClick={() => {
              onTransform((b) => applyAllFixes(b, g.items));
            }}>Fix all</Button>
        ) : (
          <span className={styles.byHand}>Fix by hand</span>
        )}
      </div>
    ) },
    ...g.items.map((f, i): HealthRow => ({ key: `${g.rule}-${f.entryId ?? "book"}-${String(i)}`, edge: i === g.items.length - 1 ? "bottom" : "mid", node: (
      <div className={styles.gitem}>
        <ListRow disabled={!f.entryId} title={f.message} onClick={() => { if (f.entryId) onJumpEntry(f.entryId); }} label={f.message} />
      </div>
    ) })),
  ]);

  return (
    <aside className={styles.pane} aria-label="Health check">
      <div className={styles.head}>
        <b>Health</b>
        <i>
          {findings.length === 0
            ? "clean"
            : `${findings.length} finding${findings.length === 1 ? "" : "s"}`}
        </i>
        <IconButton label="Close health" variant="quiet" size="sm" icon="lucide:x" onClick={onClose} />
      </div>
      {groups.length === 0 && (
        <p className={styles.clean}>Nothing to fix. This book looks healthy.</p>
      )}
      <VirtualRows items={rows} keyOf={(r) => r.key} estimate={ROW_ESTIMATE_PX} render={(r) => (
        <div className={`${styles.gedge}${r.edge === "top" ? ` ${styles.gfirst}` : r.edge === "bottom" ? ` ${styles.glast}` : ""}`}>{r.node}</div>
      )} />
    </aside>
  );
}
