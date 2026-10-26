/** @jsxImportSource @opentui/react */
/** One tool move line, shared by the live BackstageBox and the sealed BackstageRow. */
import type { ReactNode } from "react";
import { theme, colorForVerb } from "../theme";

/** Split a move line into its verb (first token, colored by palette) and the rest (soft). `dots`, when given, trails a running move. */
export function MoveRow({ raw, spine, dots }: { raw: string; spine: string; dots?: string }): ReactNode {
  const verb = raw.match(/^\S+/)?.[0] ?? raw;
  const rest = raw.slice(verb.length);
  const color = colorForVerb(verb);
  return (
    <text fg={theme.soft}>
      <span fg={color}>{spine}</span>
      <span fg={color}>{verb}</span>
      <span fg={theme.soft}>{rest}</span>
      {dots ? <span fg={color}>{dots}</span> : null}
    </text>
  );
}
