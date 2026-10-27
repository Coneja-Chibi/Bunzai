/**
 * The per-viewer Prop preferences as rows, in the row-table shape of rows.ts (a read and a write over `ctx.prefs`, which are not reactive, so a write draws the rows again): the Props
 * wing's tooltips switch (`scenes.props.tooltips`, on unless it is stored off) and TrackHare's options card (`trackhare.*`: group by book, sort, show "Didn't fire", density), read with
 * the parsers the stage uses. An open TrackHare reads its options when it mounts, so a change shows the next time it opens.
 */
import type { JSX } from "react";
import { boolOr } from "../../../../../../core/guards";
import { TOOLTIPS_PREF } from "../../../props/props-wing";
import { HARE_PREFS, parseDensity, parseSort, type Density, type SortMode } from "../../../props/trackhare/hare-core";
import type { WingArgs } from "../../wing-props";
import { RowList } from "../row-view";
import type { RowDef, RowEnv } from "../rows";

const set = (env: RowEnv, key: string, value: unknown): void => { env.ctx.prefs.set(key, value); env.repaint(); };

export const TOOLTIPS_ROW: RowDef = { id: "tooltips", label: "Prop tooltips", description: "Show a detailed tooltip on each Prop in the Props list.", control: "toggle",
  read: (env) => env.ctx.prefs.get(TOOLTIPS_PREF) !== false, write: (env, v) => set(env, TOOLTIPS_PREF, v) };

const SORTS: readonly { value: SortMode; label: string }[] = [{ value: "placement", label: "Placement" }, { value: "az", label: "A to Z" }, { value: "size", label: "Size" }];
const DENSITIES: readonly { value: Density; label: string }[] = [{ value: "detailed", label: "Detailed" }, { value: "compact", label: "Compact" }];

export const HARE_ROWS: readonly RowDef[] = [
  { id: "hare-group", label: "Group by book", description: "Gather the lore that fired under its book.", control: "toggle", read: (env) => boolOr(env.ctx.prefs.get(HARE_PREFS.group), true), write: (env, v) => set(env, HARE_PREFS.group, v) },
  { id: "hare-sort", label: "Sort", description: "Placement order, A to Z, or size.", control: "select", options: SORTS, read: (env) => parseSort(env.ctx.prefs.get(HARE_PREFS.sort)), write: (env, v) => set(env, HARE_PREFS.sort, parseSort(v)) },
  { id: "hare-misses", label: "Show \"Didn't fire\"", description: "List the entries that were checked and did not fire.", control: "toggle", read: (env) => boolOr(env.ctx.prefs.get(HARE_PREFS.misses), true), write: (env, v) => set(env, HARE_PREFS.misses, v) },
  { id: "hare-density", label: "Density", description: "How much of each entry the popover shows.", control: "select", options: DENSITIES, read: (env) => parseDensity(env.ctx.prefs.get(HARE_PREFS.density)), write: (env, v) => set(env, HARE_PREFS.density, parseDensity(v)) },
];

const envOf = (a: WingArgs): RowEnv => ({ ctx: a.ctx, repaint: a.repaint });

export const TooltipRow = ({ a }: { a: WingArgs }): JSX.Element => <RowList rows={[TOOLTIPS_ROW]} env={envOf(a)} />;
export const HareRows = ({ a }: { a: WingArgs }): JSX.Element => <RowList rows={HARE_ROWS} env={envOf(a)} />;
