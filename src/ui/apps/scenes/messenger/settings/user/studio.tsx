/** Studio: home, first deck, publish targets, the Workbench and the summary defaults are rows; the tools that belong to the whole machine open in the Settings app. */
import { useState, type JSX } from "react";
import { strArray } from "../../../../../../core/guards";
import { SETTING_KEYS } from "../../../../../../studio/settings-shape";
import type { AppContext } from "../../../../../app-contract";
import { DrillRow, ToggleRow } from "../../frames/settings-rows";
import { RowList } from "../row-view";
import type { RowEnv } from "../rows";
import { MemoryDefaultRows } from "./memory-defaults";
import { WORKBENCH_ROWS, studioRows } from "./pref-rows";
import { isList, useLoaded } from "./use-loaded";
import type { FormatInfo } from "../../../../../app-contract";

/** One switch per publish platform the format registry knows, saved as the same list the Settings app saves. */
export function PublishRows({ ctx }: { ctx: AppContext }): JSX.Element {
  const formats = useLoaded(() => ctx.api.formats(), isList<FormatInfo>).value;
  const [picked, setPicked] = useState<readonly string[]>(() => { const p = ctx.prefs.get(SETTING_KEYS.publishTargets); return strArray(p); });
  const platforms = formats ? [...new Set(formats.filter((f) => !f.native).map((f) => f.friendly))].sort((x, y) => x.localeCompare(y)) : [];
  const set = (platform: string, on: boolean): void => {
    const next = on ? [...picked, platform] : picked.filter((p) => p !== platform);
    ctx.prefs.set(SETTING_KEYS.publishTargets, next);
    setPicked(next);
  };
  return <div data-part="scene.messenger.settings.rows">{platforms.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (p) => <ToggleRow key={p} label={p} on={picked.includes(p)} onChange={(on) => set(p, on)} />)}</div>;
}

export const StudioRows = ({ env }: { env: RowEnv }): JSX.Element => <RowList rows={studioRows(env)} env={env} />;
export const WorkbenchRows = ({ env }: { env: RowEnv }): JSX.Element => <RowList rows={WORKBENCH_ROWS} env={env} />;
export const SummaryRows = ({ ctx }: { ctx: AppContext }): JSX.Element => <MemoryDefaultRows ctx={ctx} />;

/** Whole-machine tools (remote access, updates, the engine checkouts, about) are the Settings app's own pages. */
export function MachineRows({ ctx }: { ctx: AppContext }): JSX.Element {
  const go = (): void => ctx.openApp("settings");
  return (
    <div data-part="scene.messenger.settings.rows">
      <DrillRow label="Engine checkouts" description="Where SillyTavern's and Marinara's engines live on this computer." onOpen={go} />
      <DrillRow label="Remote access" description="Reach this studio from another device." onOpen={go} />
      <DrillRow label="Updates" onOpen={go} />
      <DrillRow label="About" onOpen={go} />
    </div>
  );
}
