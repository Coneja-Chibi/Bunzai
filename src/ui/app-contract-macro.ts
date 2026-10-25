/** Shared macro test-bench transport types, including explicit engine refusal results. */
export interface MacroEngineInfo { id: string; label: string }
export interface MacroResolveAsk {
  engine: string;
  text: string;
  state?: Record<string, string>;
  identity?: { user?: string; char?: string };
}
export type MacroResolveResult =
  | {
    ok: true;
    prompt: string;
    unresolved: { token: string; count: number; where?: string }[];
    warnings: string[];
    engine: { name: string; version: string };
  }
  | { ok: false; reason: string; detail: string };
