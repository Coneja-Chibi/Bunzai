/** Strict Agent decoding: allowlisted model settings and library links, never executable payloads. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { SANITY_TEXT } from "../_shared/sanity";
import type { AgentBody, CanonicalAgent } from "./schema";
const id = z.string().min(1).max(200);
export const agentBodySchema = z.strictObject(defineExhaustiveShape<AgentBody>()({
  name: z.string().max(200), description: z.string(), instructions: z.string().max(SANITY_TEXT),
  connection: z.strictObject({ id, model: id }).optional(), temperature: z.number().min(0).max(2).optional(),
  contextMessages: z.number().int().nonnegative().optional(), tools: z.array(id), skills: z.array(id),
}));
export const agentProfileSchema = agentBodySchema.partial();
export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalAgent>()(entityShape("agent", agentBodySchema, agentProfileSchema)));
