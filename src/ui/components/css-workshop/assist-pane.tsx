/**
 * Assist pane: add rule for target, rule list, knobs, delete.
 */
import { Button, ListRow } from "../button";
import type { JSX } from "react";
import type { CssDoc, CssRule } from "./model";
import { summarizeRule } from "./model";
import { RuleKnobs } from "./knobs";
import type { CssTargetPack } from "./targets/contract";
import styles from "./styles.module.css";

export interface CssAssistPaneProps {
  pack: CssTargetPack;
  doc: CssDoc;
  selected: CssRule | undefined;
  onSelectRule(id: string): void;
  onAddRule(selector: string): void;
  onRuleChange(rule: CssRule): void;
  onDeleteRule(id: string): void;
}

/** Structured assist over one rule at a time. */
export function CssAssistPane({
  pack,
  doc,
  selected,
  onSelectRule,
  onAddRule,
  onRuleChange,
  onDeleteRule,
}: CssAssistPaneProps): JSX.Element {
  return (
    <div className={styles.assist} data-tour="css-assist">
      <div className={styles.paneHead}>
        <h2 className={styles.paneTitle}>Assist</h2>
      </div>
      <p className={styles.hint}>
        Pick a target, tweak knobs, or write free CSS in Source. Knobs edit one rule at a time.
      </p>
      <div className={styles.packRow}>
        <span className={styles.packLabel}>Add rule for</span>
        <select
          className={styles.sel}
          defaultValue=""
          onChange={(e) => {
            const t = pack.targets.find((x) => x.id === e.target.value);
            if (!t) return;
            onAddRule(t.selector || ".card");
            e.target.value = "";
          }}
          aria-label="Add rule for target"
        >
          <option value="">choose target…</option>
          {pack.targets.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (t) => (
            <option key={t.id} value={t.id}>
              {t.label}
              {t.selector ? ` (${t.selector})` : ""}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => onAddRule(".card")}>
          + Blank rule
        </Button>
      </div>

      {doc.rules.length === 0 ? (
        <div className={styles.empty}>
          <b>No rules yet</b>
          <p className={styles.hint}>No parsed rules yet. Use a Starter or open Source and write CSS.</p>
        </div>
      ) : (
        <div className={styles.ruleList}>
          {doc.rules.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (r) => (
            <ListRow
              key={r.id}
              label={summarizeRule(r)}
              selected={selected?.id === r.id}
              onClick={() => onSelectRule(r.id)}
            />
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className={styles.english}>{summarizeRule(selected)}</div>
          <RuleKnobs rule={selected} onChange={onRuleChange} />
          <div className={styles.actions}>
            <Button size="sm" variant="danger" onClick={() => onDeleteRule(selected.id)}>
              Delete rule
            </Button>
          </div>
        </>
      )}

      {doc.freeform.trim() ? (
        <p className={styles.hint}>
          Extra CSS kept as freeform (@media / nested): edit in Source. Not dropped on save.
        </p>
      ) : null}
    </div>
  );
}
