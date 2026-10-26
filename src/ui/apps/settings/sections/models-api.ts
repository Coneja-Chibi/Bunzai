/** The vault's provider routes the Models section and the Messenger's AI connection page both call: the saved list and one real test request. */
import { apiFetchJson } from "../../../_shared/api-fetch";
import type { SafeProvider } from "./models-core";

export const listProviders = async (): Promise<SafeProvider[]> => (await apiFetchJson<{ providers: SafeProvider[] }>("/api/agent/providers")).providers;

/** A real call to the real endpoint: "saved" and "works" are different states. */
export const testProvider = (id: string): Promise<{ ok: boolean; ms?: number; error?: string }> =>
  apiFetchJson<{ ok: boolean; ms?: number; error?: string }>("/api/agent/providers/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });

/** The line a test result is shown as. */
export const testWords = (r: { ok: boolean; ms?: number; error?: string }): string => (r.ok ? `answered in ${String(r.ms ?? 0)}ms` : (r.error ?? "no answer"));
