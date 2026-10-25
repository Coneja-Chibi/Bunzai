/** @jsxImportSource @opentui/react */
/**
 * Provider picker: the drop-in spokes as flat .li rows (the picker pane is always the active pane in
 * this mode, so the current row lights up: row background, rose gutter accent, bright text). Each
 * row leads with a brand square echoing the rose logo mark. Clicking a row picks it.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import type { SettingsState } from "./model";
import { SelectableRow } from "../primitives/selectable-row";

export function Picker({
  state,
  onPick,
}: {
  state: SettingsState;
  onPick: (index: number) => void;
}): ReactNode {
  return (
    <box flexDirection="column">
      <box paddingLeft={2}>
        <text fg={theme.mut}>Choose a provider</text>
      </box>
      <box flexDirection="column" paddingTop={1}>
        {state.choices.map((choice, index) => {
          const selected = index === state.pickerIndex;
          return (
            <SelectableRow key={choice.id} selected={selected} onMouseDown={() => onPick(index)}>
              <text fg={choice.brand}>{"■ "}</text>
              <text fg={selected ? theme.text : theme.soft}>{choice.label}</text>
            </SelectableRow>
          );
        })}
      </box>
    </box>
  );
}
