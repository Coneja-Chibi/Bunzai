/**
 * The generation parameter registry: every group's parameters in one list, in the order the panel shows them
 * (core, reasoning, the thinking switches, then the catalogue groups).
 */
import { ADVANCED_PARAMS } from "./advanced";
import { CONSTRAINTS_PARAMS } from "./constraints";
import { CORE_PARAMS } from "./core";
import { NUCLEUS_PARAMS } from "./nucleus";
import { PENALTIES_PARAMS } from "./penalties";
import { REASONING_PARAMS } from "./reasoning";
import { THINKING_PARAMS } from "./thinking";
import type { ParamDef, ParamGroup } from "./types";

export type { ParamDef, ParamGroup, ParamKind, ParamValue } from "./types";

export const PARAMS: readonly ParamDef[] = [...CORE_PARAMS, ...REASONING_PARAMS, ...THINKING_PARAMS, ...NUCLEUS_PARAMS, ...PENALTIES_PARAMS, ...CONSTRAINTS_PARAMS, ...ADVANCED_PARAMS];

const BY_ID: ReadonlyMap<string, ParamDef> = new Map(PARAMS.map((p) => [p.id, p]));

export const paramById = (id: string): ParamDef | undefined => BY_ID.get(id);

export const paramsIn = (group: ParamGroup): readonly ParamDef[] => PARAMS.filter((p) => p.group === group);
