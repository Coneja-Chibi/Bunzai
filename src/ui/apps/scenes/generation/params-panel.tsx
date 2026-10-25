/**
 * The catalogue groups on the Generation tab (generation-params-groups.tsx: Nucleus Sampling, Repetition Penalties, Output
 * Constraints, Advanced, Custom Request Parameters). This panel gives them the tab's search text, reports their enabled count
 * to the tab's header, and answers its Reset (every switched-on parameter off, the typed fields they share with the Booth
 * included). Writes go through the one scene preset writer. Enable Thinking, which Clear Thinking hangs from, is on while
 * Reasoning Effort is a level (the one Reasoning control).
 */
import type { JSX } from "react";
import { GenerationParamGroups, useGenerationProvider } from "../generation-params-groups";
import { groupsEnabled, resetParams } from "../generation-params-core";
import { useGenerationSection, type GenerationEnv } from "./generation-env";

export function ParamsPanel({ env, query }: { env: GenerationEnv; query: string }): JSX.Element {
  const { ctx, chat, own, preset } = env;
  const provider = useGenerationProvider(ctx, chat);
  const presetSamplers = preset.state === "ready" ? preset.body.samplers : undefined;
  useGenerationSection("params", own.own ? groupsEnabled(own.own.samplers.params, { ...presetSamplers, ...own.own.samplers }) : 0, () => own.edit((p) => ({ ...p, samplers: resetParams(p.samplers) })));
  return <GenerationParamGroups own={own} presetSamplers={presetSamplers} provider={provider} query={query} thinking={env.thinking} {...(chat.connection ? { model: chat.connection.model } : {})} />;
}
