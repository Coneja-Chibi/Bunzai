/** Raw lazy-argument operations shared by macros that preserve authored whitespace and separators. */
import type { LazyMacroArg } from "./types";

/** Return the unevaluated argument body exactly as authored, rejoining its depth-zero separators. */
export const joinRaw = (args: readonly LazyMacroArg[], from: number): string =>
  args.slice(from).map((arg) => arg.raw).join("::");
