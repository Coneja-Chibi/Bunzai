/**
 * FinePrint - the folded advanced controls (design/vs-regex-editor.html details.card). Depth window,
 * run-on-edit, macro substitution, and who it applies to are capability-gated per Write-for lens
 * (fieldVisible); the vaud-engine extras (first match only, overlay, conditional chaining) have no
 * wire anywhere, so they always show and travel-lint marks them under a foreign lens. Every control
 * is a plain switch or select - no raw booleans, no positional flags.
 */
import type { JSX, ReactNode } from "react";
import { fieldOr, useFramed } from "../framed";
import type {
  RegexRule,
  RegexSubstitution,
} from "../../../../entities/regex/schema";
import { fieldVisible, type RegexWriteForProfile } from "../../../../core/regex";
import { numOrNull } from "../../../../core/guards";
import { Toggle } from "../../../components/button";

export interface FinePrintProps {
  rule: RegexRule;
  rules: readonly RegexRule[];
  writeFor: RegexWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<RegexRule>) => void;
}

const SUBSTITUTIONS: readonly RegexSubstitution[] = ["none", "raw", "escaped", "after"];
const SUB_LABELS: Record<RegexSubstitution, string> = {
  none: "Off",
  raw: "Raw",
  escaped: "Escaped",
  after: "After",
};

const parseDepth = (raw: string): number | null => {
  const v = raw.trim();
  if (v === "") return null;
  const n = Number(v);
  return numOrNull(n);
};

export function FinePrint({ rule, rules, writeFor, styles, onPatch }: FinePrintProps): JSX.Element {
  const themed = useFramed();
  /** one fine-print row: EditorField under a theme frame, the key-and-control row in core */
  const row = (label: string, control: ReactNode): ReactNode =>
    fieldOr(themed, { label }, control, (c) => (
      <div className={styles.rrow}>
        <span className={styles.rk}>{label}</span>
        {c}
      </div>
    ));
  const showDepth = fieldVisible(writeFor, "minDepth") || fieldVisible(writeFor, "maxDepth");
  const showRunOnEdit = fieldVisible(writeFor, "runOnEdit");
  const showSubstitute = fieldVisible(writeFor, "substituteFind");
  const showCharacters = fieldVisible(writeFor, "characterIds");
  const others = rules.filter((r) => r.id !== rule.id);
  const condition = rule.condition;

  return (
    <details className={styles.finePrint}>
      <summary className={styles.fpSummary}>
        <span className={styles.cheadB}>Fine print</span>
        <span className={styles.cheadI}>depth · edits · trims · who it applies to</span>
      </summary>
      <div className={styles.fpBody}>
        {showDepth && (
          <>
            {row("Only messages deeper than", (
              <input
                className={styles.rvNum}
                inputMode="numeric"
                placeholder="any"
                value={rule.minDepth ?? ""}
                aria-label="Minimum message depth"
                onChange={(e) => onPatch({ minDepth: parseDepth(e.target.value) })}
              />
            ))}
            {row("Only messages shallower than", (
              <input
                className={styles.rvNum}
                inputMode="numeric"
                placeholder="any"
                value={rule.maxDepth ?? ""}
                aria-label="Maximum message depth"
                onChange={(e) => onPatch({ maxDepth: parseDepth(e.target.value) })}
              />
            ))}
          </>
        )}

        {showRunOnEdit && row("Run again when a message is edited", (
          <Toggle size="sm" on={rule.runOnEdit === true} aria-label="Run again when a message is edited" onChange={() => onPatch({ runOnEdit: !rule.runOnEdit })} />
        ))}

        {showSubstitute && row("Macros in the find", (
          <select
            className={styles.fpSelect}
            value={rule.substituteFind ?? "none"}
            aria-label="Macros in the find pattern"
            onChange={(e) => onPatch({ substituteFind: e.target.value as RegexSubstitution })}
          >
            {SUBSTITUTIONS.map((s) => (
              <option key={s} value={s}>
                {SUB_LABELS[s]}
              </option>
            ))}
          </select>
        ))}

        {showCharacters && row("Only for these characters", (
          <input
            className={styles.fpInput}
            placeholder="everyone"
            value={(rule.characterIds ?? []).join(", ")}
            aria-label="Only for these characters"
            onChange={(e) => {
              const ids = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
              onPatch({ characterIds: ids.length > 0 ? ids : undefined });
            }}
          />
        ))}

        {row("Replace only the first match", (
          <Toggle size="sm" on={rule.firstMatchOnly === true} aria-label="Replace only the first match" onChange={() => onPatch({ firstMatchOnly: !rule.firstMatchOnly })} />
        ))}

        {row("Draw over the text instead of changing it", (
          <Toggle size="sm" on={rule.overlay === true} aria-label="Draw over the text instead of changing it" onChange={() => onPatch({ overlay: !rule.overlay })} />
        ))}

        {row("Only run after another rule", (
          <select
            className={styles.fpSelect}
            value={condition?.ruleId ?? ""}
            aria-label="Only run after another rule"
            onChange={(e) => {
              const ruleId = e.target.value;
              onPatch({
                condition: ruleId ? { ruleId, matched: condition?.matched ?? true } : undefined,
              });
            }}
          >
            <option value="">Always run</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label.trim() || "Untitled rule"}
              </option>
            ))}
          </select>
        ))}

        {condition && row("...and that rule", (
          <select
            className={styles.fpSelect}
            value={condition.matched ? "fired" : "missed"}
            aria-label="...and that rule"
            onChange={(e) =>
              onPatch({ condition: { ruleId: condition.ruleId, matched: e.target.value === "fired" } })
            }
          >
            <option value="fired">fired</option>
            <option value="missed">did not fire</option>
          </select>
        ))}
      </div>
    </details>
  );
}
