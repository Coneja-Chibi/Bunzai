/** Structural equality of two casts. A store backend may not value-import the engine's guards (D18 rule 1), so it calls this interface-level helper. */
import { deepEq } from "../../core/guards";
import type { Cast } from "../contracts/chat-store";

export const sameCast = (a: Cast, b: Cast): boolean => deepEq(a, b);
