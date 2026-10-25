/** Per-keyring cancellation subscriptions and standalone copied-key leases for owned background jobs. */
import type { subkeys } from "./crypto";
import { LockedError } from "./keyring-errors";

export type KeyLease = {
  content: Uint8Array; index: Uint8Array; signal: AbortSignal;
  valid(): boolean; release(): void;
};

export function createKeyringLifecycle(keys: () => ReturnType<typeof subkeys> | null) {
  const listeners = new Set<() => void>();
  return {
    access: {
      onDropKeys(listener: () => void): () => void {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      leaseKeys(): KeyLease {
        const pin = keys();
        if (!pin) throw new LockedError();
        const content = new Uint8Array(pin.content);
        const index = new Uint8Array(pin.index);
        const controller = new AbortController();
        let released = false;
        const release = (): void => {
          if (released) return;
          released = true;
          listeners.delete(release);
          try { controller.abort(); }
          finally {
            // Transferred arrays are detached; their receiver owns wiping those copies.
            if (content.byteLength) content.fill(0);
            if (index.byteLength) index.fill(0);
          }
        };
        listeners.add(release);
        return { content, index, signal: controller.signal, valid: () => !released && keys() === pin, release };
      },
    },
    drop(): void {
      for (const listener of [...listeners]) {
        try { listener(); }
        catch { /* A failed cancellation must not prevent other jobs or key clearing. */ }
      }
    },
  };
}
