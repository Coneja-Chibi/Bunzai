/**
 * What a tool's definition costs in tokens on every reply: the same count the tool editor's rail shows ("Adds to every reply") and the Control Booth's tool tiles sum, so the two cannot
 * disagree. It counts the definition the provider is handed (core/tools.ts toolDefinition), not a second description of the fields.
 */
import { countText } from "../../../../core/tokens";
import { callName, toolDefinition } from "../../../../core/tools";
import type { ToolBody } from "../../../../entities/tool/schema";

export const toolTokens = (body: ToolBody): number => countText(JSON.stringify(toolDefinition(body, callName(body.name))));
