/**
 * Guides, RoleCall's "Guided Responses", as prompt assembly applies them. RoleCall splits this over three
 * places and this module ports all three at the:
 *  - `guide-runtime.ts` sorts a scene's selected guides into the five payloads (`resolveGuides`);
 *  - `prompt-assembly.ts` 4.5 and 4.6 decorate macro values (`decorateMacroValue`) and run chat-start
 *    guides once per scene (`startLatchKey`);
 *  - the worker (`worker.ts` after assembly, `jobs/depth-guides.ts`) adds the system block, places the
 *    depth and append guides, and chooses the prefill (`applyGuides`).
 * A standard user-role guide is prepended to the message being answered (`prependUserGuides`). RoleCall
 * prepends it to the text the person sends, which stores it in the transcript; here it is prepended when
 * the request is built, so it never enters the stored message (a named deviation).
 */
import type { Block } from "./conversation";
import { appendAtDepth } from "./conversation";
import type { AssembledRole } from "./types";

export type GuideMode = "standard" | "depth" | "append" | "macro" | "chat_start";
export type MacroTarget = "persona" | "description" | "personality" | "scenario" | "summary";

/** One selected guide as assembly needs it (RoleCall's SelectedGuideRuntimeInput). */
export interface AssemblyGuide {
  id: string;
  content: string;
  role: AssembledRole;
  mode: GuideMode;
  /** For depth and append: how far from the end (see `placeDepthGuide`). */
  depth?: number | null;
  target?: MacroTarget | null;
  side?: "append" | "prepend" | null;
}

export interface ResolvedGuides {
  /** Standard user-role guides, prepended to the message being answered. */
  user: string[];
  /** The one system block standard system-role guides make, or undefined. */
  system?: string;
  /** Standard assistant-role guides: the chat-level prefill, which replaces the preset's. */
  prefill: string[];
  depth: { content: string; role: AssembledRole; depth: number; append: boolean }[];
  macro: { content: string; target: MacroTarget; side: "append" | "prepend" }[];
  chatStart: { id: string; content: string }[];
}

const hasDepthPlacement = (g: AssemblyGuide): boolean => typeof g.depth === "number" || g.mode === "depth" || g.mode === "append";

/** RoleCall's `resolveGuideRuntime`: a guide with no content is skipped, the rest go to exactly one payload. */
export function resolveGuides(guides: readonly AssemblyGuide[] | undefined): ResolvedGuides {
  const source = (guides ?? []).filter((g) => g.content.trim());
  const assembly = (g: AssemblyGuide) => g.mode === "macro" || g.mode === "chat_start";
  const standard = source.filter((g) => !hasDepthPlacement(g) && !assembly(g));
  const system = standard.filter((g) => g.role === "system").map((g) => g.content);
  return {
    user: standard.filter((g) => g.role === "user").map((g) => g.content),
    ...(system.length > 0 ? { system: `[Take the following into special consideration for your next message: ${system.join(" ")}]` } : {}),
    prefill: standard.filter((g) => g.role === "assistant").map((g) => g.content),
    depth: source.filter((g) => hasDepthPlacement(g) && !assembly(g)).map((g) => ({ content: g.content, role: g.role, depth: Math.max(0, Math.floor(Number(g.depth) || 0)), append: g.mode === "append" })),
    macro: source.filter((g) => g.mode === "macro" && g.target).map((g) => ({ content: g.content, target: g.target!, side: g.side === "prepend" ? ("prepend" as const) : ("append" as const) })),
    chatStart: source.filter((g) => g.mode === "chat_start").map((g) => ({ id: g.id, content: g.content })),
  };
}

/** RoleCall's `prependUserGuides`: each guide goes in front, so the last one selected reads first. */
export const prependUserGuides = (content: string, guides: readonly string[]): string => guides.reduce((message, guide) => `${guide}\n\n${message}`, content);

/**
 * RoleCall's `decorateMacroValue`: a macro value with every guide aimed at it glued on, in order. An
 * empty value still takes the guide, so a persona-aimed guide works with no persona.
 */
export function decorateMacroValue(base: string, guides: ResolvedGuides["macro"], target: MacroTarget): string {
  let out = base;
  for (const g of guides) {
    const content = g.content.trim();
    if (g.target !== target || !content) continue;
    out = !out.trim() ? content : g.side === "prepend" ? `${content}\n${out}` : `${out}\n${content}`;
  }
  return out;
}

/** The scene variable that marks a chat-start guide as already run (RoleCall's `chatStartLatchKey`). */
export const startLatchKey = (guideId: string): string => `__rc_chat_start_fired::${guideId}`;

const clamp = (raw: number, max: number): number => Math.max(0, Math.min(max, Number.isFinite(raw) ? Math.floor(raw) : 0));

/**
 * RoleCall's `injectDepthGuides` over the request without its leading system prefix. An inject guide
 * becomes its own message `depth` places above the end of the chat, counted from the last user message
 * rather than the end of the list, so a preset's closing blocks never bury it (RoleCall VVS-610); an
 * append guide is glued onto the depth-th message from the end with its role. Guides apply in order.
 */
function placeDepthGuides(body: Block[], guides: ResolvedGuides["depth"], expand: (text: string) => string): Block[] {
  let out = body;
  const injected = new Set<Block>();
  for (const g of guides) {
    const content = expand(g.content).trim();
    if (!content) continue;
    const source = { kind: "guide" as const };
    if (g.append) {
      const glued = appendAtDepth(out, { role: g.role, content, source }, g.depth, { start: 0, end: out.length });
      out = glued.blocks;
      continue;
    }
    const role: AssembledRole = g.role === "user" || g.role === "assistant" ? g.role : "system";
    const depth = clamp(g.depth, out.length);
    let lastUser = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i]!.role === "user" && !injected.has(out[i]!)) {
        lastUser = i;
        break;
      }
    }
    let at = Math.max(0, Math.min(out.length, (lastUser >= 0 ? lastUser + 1 : 0) - depth));
    // Past guides already placed here, so same-depth guides keep their order.
    while (at < out.length && injected.has(out[at]!)) at++;
    const block: Block = { role, content, source };
    out = [...out.slice(0, at), block, ...out.slice(at)];
    injected.add(block);
  }
  return out;
}

/**
 * The worker's steps after assembly, in its order: only the leading system prefix is lifted, the system
 * block follows that prefix, then depth and append guides land in the rest. `expand` is the assembly's own
 * macro pass; guide text is not stripped of unresolved macros, as in RoleCall.
 */
export function applyGuides(blocks: readonly Block[], guides: ResolvedGuides, expand: (text: string) => string): Block[] {
  let lead = 0;
  while (lead < blocks.length && blocks[lead]!.role === "system") lead++;
  const system: Block[] = guides.system ? [{ role: "system", content: expand(guides.system), source: { kind: "guide" } }] : [];
  return [...blocks.slice(0, lead), ...system, ...placeDepthGuides(blocks.slice(lead), guides.depth, expand)];
}
