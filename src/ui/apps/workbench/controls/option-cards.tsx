/**
 * OptionCards - the pickable rose-PICKED option cards (lettered rank + title + optional sub), the shape
 * used by both the `select` field control and the quiz's rating card. Extracted from Editor.tsx where it
 * was written twice, near-identically. Takes the editor's style module so it reuses the exact chrome
 * (opts/opt/optOn/optMark/rank/optBody/optTitle/optSub) with no CSS duplication.
 */
import { Card } from "../../../components/button";
import type { JSX } from "react";

export interface OptionCard {
  value: string;
  title: string;
  /** an optional second line (the rating cards use it; plain selects do not) */
  sub?: string;
}

export interface OptionCardsProps {
  options: readonly OptionCard[];
  value: string;
  onSelect(value: string): void;
  styles: Readonly<Record<string, string>>;
}

export function OptionCards({ options, value, onSelect, styles }: OptionCardsProps): JSX.Element {
  return (
    <div className={styles.opts}>
      {options.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (o, i) => {
        const on = value === o.value;
        return (
          <Card
            key={o.value || "none"}
            kind="choice"
            selected={on}
            aria-pressed={on}
            onClick={() => onSelect(o.value)}
            kicker={String.fromCharCode(65 + i)}
            heading={o.title}
            subtitle={o.sub}
          />
        );
      })}
    </div>
  );
}
