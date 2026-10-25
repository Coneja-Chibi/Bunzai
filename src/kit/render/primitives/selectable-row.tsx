/** @jsxImportSource @opentui/react */
/** The shared selected-row shell used by Kit's settings lists. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function SelectableRow({
  selected,
  onMouseDown,
  children,
  gutter = "▌",
}: {
  selected: boolean;
  onMouseDown(): void;
  children: ReactNode;
  gutter?: string;
}): ReactNode {
  return (
    <box flexDirection="row" backgroundColor={selected ? theme.row : theme.panel} paddingRight={1} onMouseDown={onMouseDown}>
      <text fg={theme.rose}>{selected ? `${gutter} ` : "  "}</text>
      {children}
    </box>
  );
}
