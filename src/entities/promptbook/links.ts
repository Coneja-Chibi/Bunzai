/** Structured Promptbook references for shared export, import renaming and delete warnings. Unknown shapes link nothing. */
import { isRecord } from "../../core/guards";
import type { PromptbookBody } from "./schema";
const phasesOf = (body: unknown): Record<string, unknown>[] => isRecord(body) && Array.isArray(body.phases) ? body.phases.filter(isRecord) : [];
export function bookCardIds(body: unknown, kind: string): string[] {
  return phasesOf(body).flatMap((p) => Array.isArray(p.cards) ? p.cards.flatMap((c) => isRecord(c) && c.kind === kind && typeof c.pieceId === "string" ? [c.pieceId] : []) : []);
}
export const bookAgentIds = (body: unknown): string[] => phasesOf(body).flatMap((p) => typeof p.agentId === "string" ? [p.agentId] : []);
export function renameBookLinks(body: PromptbookBody, renamed: ReadonlyMap<string, string>): PromptbookBody {
  return { ...body, phases: body.phases.map((p) => ({ ...p, ...(p.agentId ? { agentId: renamed.get(`agent:${p.agentId}`) ?? p.agentId } : {}), cards: p.cards.map((c) => ({ ...c, pieceId: renamed.get(`${c.kind}:${c.pieceId}`) ?? c.pieceId })) })) };
}
