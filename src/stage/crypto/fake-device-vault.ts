/**
 * Test support: a stand-in for one computer's OS key store (DPAPI or a keychain). Each fake computer
 * has its own secret, so a copy sealed on one provably does not open on another. Used only by
 * tests; the app uses device-vault.ts.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { DeviceVault } from "./keyring";

export interface FakeComputerOptions {
  /** Hold each seal this long, so concurrent calls really overlap. */
  delayMs?: number;
  /** Make sealing fail while this returns true. */
  failSeal?: () => boolean;
  /** Make opening fail while this returns true, like a keychain that is locked for a moment. */
  failOpen?: () => boolean;
  /** This computer's id, when a test needs to change it (as if the id file were lost). */
  computerId?: () => string;
  /** The lock this computer seals with; "identity-file" is the weak one. */
  lock?: string;
  /** Whether a stronger lock than the one on a copy is available now. */
  strongerAvailable?: () => boolean;
}

let counter = 0;

export function fakeComputer(opts: FakeComputerOptions = {}): DeviceVault {
  const secret = randomBytes(8).toString("hex");
  const id = randomUUID();
  const label = `Test computer ${++counter}`;
  const lock = () => opts.lock ?? "dpapi";
  return {
    async seal(text) {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.failSeal?.()) throw new Error("the vault is unavailable");
      return JSON.stringify({ secret, text, lock: lock() });
    },
    async open(sealed) {
      if (opts.failOpen?.()) throw new Error("the vault is unavailable");
      const s = JSON.parse(sealed) as { secret: string; text: string };
      if (s.secret !== secret) throw new Error("sealed on another computer");
      return s.text;
    },
    computerId: async () => opts.computerId?.() ?? id,
    computerIdForNewCopy: async () => opts.computerId?.() ?? id,
    computerLabel: async () => label,
    lockOf(sealed) {
      const l = (JSON.parse(sealed) as { lock: string }).lock;
      return { lock: l, weak: l === "identity-file" };
    },
    async strongerThan(sealed) {
      return (JSON.parse(sealed) as { lock: string }).lock === "identity-file" && (opts.strongerAvailable?.() ?? false);
    },
  };
}
