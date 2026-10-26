/** The shared answer for a route that calls the scene's model: the result as JSON, or a provider failure as a 502 carrying its category and code. Anything else rethrows. */
import { ProviderError } from "../stage/contracts/provider";
import { json } from "./server-security";

export async function providerJson(run: () => Promise<unknown>): Promise<Response> {
  try {
    return json(await run());
  } catch (e) {
    if (e instanceof ProviderError) return json({ error: e.message, code: e.code, category: e.category, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) }, 502);
    throw e;
  }
}
