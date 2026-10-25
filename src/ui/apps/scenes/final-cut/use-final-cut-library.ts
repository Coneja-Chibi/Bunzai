/**
 * The person's Final Cut library for the tab (studio/final-cut-library.ts): their own Anti-Slop banks and saved Custom Agents, read when the
 * tab opens and kept in step with each save and delete. Writes go one after another, and a failed one says why and changes nothing on screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { AgentRecord, BankRecord } from "../../../../studio/final-cut-library";
import { toErrorMessage } from "../../../_shared/error-message";

export interface FinalCutLibrary {
  state: "loading" | "ready" | "failed";
  banks: BankRecord[];
  agents: AgentRecord[];
  /** Why the last read or write failed; null when none did. */
  error: string | null;
  saveBank(bank: Record<string, unknown>): Promise<BankRecord | null>;
  deleteBank(id: string): Promise<void>;
  saveAgent(agent: Record<string, unknown>): Promise<AgentRecord | null>;
  deleteAgent(id: string): Promise<void>;
}

export function useFinalCutLibrary(ctx: AppContext): FinalCutLibrary {
  const [state, setState] = useState<FinalCutLibrary["state"]>("loading");
  const [banks, setBanks] = useState<BankRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const live = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const load = useCallback(() => {
    api.current.getFinalCutLibrary().then(
      (lib) => { if (!live.current) return; setBanks(lib.banks); setAgents(lib.agents); setState("ready"); setError(null); },
      (e: unknown) => { if (!live.current) return; setState("failed"); setError(toErrorMessage(e, "The Final Cut library could not be read.")); },
    );
  }, []);
  useEffect(load, [load]);

  /** One write after another; `apply` puts the answer on screen, and a failure is shown and rethrown to the caller's null. */
  const write = <T,>(work: () => Promise<T>, apply: (made: T) => void): Promise<T | null> => {
    const done = queue.current.then(async () => {
      try {
        const made = await work();
        if (live.current) { apply(made); setError(null); }
        return made;
      } catch (e) {
        if (live.current) setError(toErrorMessage(e, "That change could not be saved."));
        return null;
      }
    });
    queue.current = done;
    return done;
  };
  const put = <R extends { id: string }>(list: R[], made: R): R[] => [made, ...list.filter((r) => r.id !== made.id)];
  return {
    state, banks, agents, error,
    saveBank: (bank) => write(() => api.current.saveFinalCutBank(bank), (made) => setBanks((l) => put(l, made))),
    saveAgent: (agent) => write(() => api.current.saveFinalCutAgent(agent), (made) => setAgents((l) => put(l, made))),
    deleteBank: async (id) => { await write(() => api.current.deleteFinalCutBank(id), () => setBanks((l) => l.filter((b) => b.id !== id))); },
    deleteAgent: async (id) => { await write(() => api.current.deleteFinalCutAgent(id), () => setAgents((l) => l.filter((a) => a.id !== id))); },
  };
}
