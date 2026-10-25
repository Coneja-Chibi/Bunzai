/**
 * Run one untrusted Lua card script in a fresh hardened engine and return a Result (never throws for a
 * card fault - a card crashing or looping is expected input, not a broken invariant). The engine is
 * closed in finally, win or lose. A pure-Lua infinite loop surfaces as reason "timeout". Host-state
 * quota failures surface as reason "resource" with a machine-readable limit category.
 *
 * Boundary note: the timeout interrupts pure Lua. A card blocked INSIDE a host capability (an await that
 * never resolves) is not unstuck here - the Worker backstop kills that. This module is the in-VM tier.
 */
import { toErrorMessage } from "../../error-message";
import { LuaTimeoutError, type LuaEngine } from "wasmoon";
import { createHardenedLua, type HardenedLuaOptions } from "./engine";
import { classifyLuaError, type LuaResourceReason } from "./limits";

export type LuaRunResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "timeout" | "error" | "resource";
      /** Present when reason is "resource". */
      limit?: LuaResourceReason;
      message: string;
    };

const asResourceFailure = (
  err: unknown,
): Extract<LuaRunResult, { ok: false }> | null => {
  const c = classifyLuaError(err);
  return c.reason === "resource" ? { ok: false, reason: "resource", limit: c.limit, message: c.message } : null;
};

/** Run untrusted Lua source (text only) with the hardened engine + given capabilities. */
export async function runLua(code: string, opts: HardenedLuaOptions = {}): Promise<LuaRunResult> {
  let engine: LuaEngine | undefined;
  try {
    engine = await createHardenedLua(opts);
    const value = (await engine.doString(code)) as unknown;
    // A chunk that returns nothing yields Lua nil, which the bridge hands back as JS undefined.
    // The result crosses a JSON wire where undefined is not representable; nil is a value ("no
    // value"), so normalize it to null here at the one boundary Lua semantics enter JS.
    return { ok: true, value: value ?? null };
  } catch (err) {
    if (err instanceof LuaTimeoutError) {
      return { ok: false, reason: "timeout", message: err.message };
    }
    const resource = asResourceFailure(err);
    if (resource) return resource;
    return { ok: false, reason: "error", message: toErrorMessage(err) };
  } finally {
    engine?.global.close();
  }
}
