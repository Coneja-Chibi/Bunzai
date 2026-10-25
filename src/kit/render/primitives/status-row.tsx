/** @jsxImportSource @opentui/react */
/**
 * StatusRow, the stagehand (DECISIONS #24): while Kit is out working, a hushed in-transcript line.
 * A rose dot breathes (~1.6s dim-to-bright), lowercase stage verbs rotate slowly, dots step at
 * ~800ms, and the elapsed clock rides the tail as a small deep-rose stamp with white digits. No
 * provider name, ever. Covers both waiting and thinking until the thinking look is designed.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { useTick } from "./use-tick";
import { ElapsedStamp } from "./elapsed-stamp";

const VERBS = ["cueing", "rifling", "staging", "rehearsing", "consulting"] as const;
// The breath, translated to cells: the dot's ink steps dim-to-bright-to-dim (~1.6s full cycle).
const BREATH = [theme.mut, theme.roseDeep, theme.rose, theme.roseDeep] as const;

export function StatusRow({ startedAt }: { startedAt: number }): ReactNode {
  useTick(200);
  const elapsed = Date.now() - startedAt;
  const dotInk = BREATH[Math.floor(elapsed / 400) % BREATH.length]!;
  const verb = VERBS[Math.floor(elapsed / 5200) % VERBS.length]!;
  const dots = ".".repeat(Math.floor(elapsed / 800) % 3 + 1);
  return (
    <box flexDirection="row">
      <text fg={theme.mut}>
        <span fg={dotInk}>·</span> {verb}
        {dots}{" "}
      </text>
      <ElapsedStamp ms={elapsed} />
    </box>
  );
}
