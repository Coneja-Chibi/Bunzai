/**
 * Every macro family, in RoleCall's registration order. The order is behavior: when two families claim a name or alias, the earlier
 * one owns it (registry.ts). RoleCall's game, off-band, visual novel, and mechanics families are not
 * here; dropping them changes the owner of no name a kept family
 * declares, checked against RoleCall on 2026-09-27.
 */
import type { MacroDefinition } from "./types";
import { IDENTITY_MACROS } from "./handlers/identity";
import { TIME_MACROS } from "./handlers/time";
import { RANDOM_MACROS } from "./handlers/random";
import { SCENE_MACROS } from "./handlers/scene";
import { CHARACTER_MACROS } from "./handlers/character";
import { VARIABLES_MACROS } from "./handlers/variables";
import { CONDITIONAL_MACROS } from "./handlers/conditional";
import { TEXT_MACROS } from "./handlers/text";
import { LOREBOOK_MACROS } from "./handlers/lorebook";
import { PRONOUNS_MACROS } from "./handlers/pronouns";
import { ROLEPLAY_MACROS } from "./handlers/roleplay";
import { STATS_MACROS } from "./handlers/stats";
import { RUNTIME_MACROS } from "./handlers/runtime";
import { USER_MACROS_MACROS } from "./handlers/user-macros";
import { LUMIVERSE_COMPAT_MACROS } from "./handlers/lumiverse-compat";
import { PRESET_INTROSPECTION_MACROS } from "./handlers/preset-introspection";
import { CHOICE_MACROS } from "./handlers/choice";
import { ST_COMPAT_VARS_MACROS } from "./handlers/st-compat-vars";
import { STATE_MACROS } from "./handlers/state";
import { ITERATION_MACROS } from "./handlers/iteration";
import { TIMING_MACROS } from "./handlers/timing";
import { IN_REPLY_MACROS } from "./handlers/in-reply";
import { COMPOSITION_MACROS } from "./handlers/composition";
import { PHASE_MACROS_MACROS } from "./handlers/phase-macros";
import { MATH_MACROS } from "./handlers/math";
import { CHAT_WATCH_MACROS } from "./handlers/chat-watch";

export const CATALOG: readonly MacroDefinition[] = [
  ...IDENTITY_MACROS,
  ...TIME_MACROS,
  ...RANDOM_MACROS,
  ...SCENE_MACROS,
  ...CHARACTER_MACROS,
  ...VARIABLES_MACROS,
  ...CONDITIONAL_MACROS,
  ...TEXT_MACROS,
  ...LOREBOOK_MACROS,
  ...PRONOUNS_MACROS,
  ...ROLEPLAY_MACROS,
  ...STATS_MACROS,
  ...RUNTIME_MACROS,
  ...USER_MACROS_MACROS,
  ...LUMIVERSE_COMPAT_MACROS,
  ...PRESET_INTROSPECTION_MACROS,
  ...CHOICE_MACROS,
  ...ST_COMPAT_VARS_MACROS,
  ...STATE_MACROS,
  ...ITERATION_MACROS,
  ...TIMING_MACROS,
  ...IN_REPLY_MACROS,
  ...COMPOSITION_MACROS,
  ...PHASE_MACROS_MACROS,
  ...MATH_MACROS,
  // Bunraku's own, last so they never take a RoleCall name
  ...CHAT_WATCH_MACROS,
];
