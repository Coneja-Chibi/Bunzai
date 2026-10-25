/**
 * The password lock's worker on the background lane (src/stage/worker-lane.ts): Argon2id runs here,
 * off the main thread, so checking a password never pauses the app. Run in slices on the main
 * thread, its 64 MiB setup and the garbage collection around it still paused the app past the
 * 100 ms budget with a large library loaded (measured 2026-09-23: up to 113 ms). One job per
 * message; the worker answers with the derived key or a reason, and never throws past the boundary.
 */
import { toErrorMessage } from "../../error-message";
import { argon2id } from "@noble/hashes/argon2.js";

declare const self: Worker;

export interface PasswordJob {
  password: string;
  salt: Uint8Array;
  m: number;
  t: number;
  p: number;
}

export type PasswordReply = { ok: true; kek: Uint8Array } | { ok: false; reason: string };

self.onmessage = (event: MessageEvent<PasswordJob>) => {
  const { password, salt, m, t, p } = event.data;
  let reply: PasswordReply;
  try {
    reply = { ok: true, kek: argon2id(password, salt, { m, t, p, dkLen: 32 }) };
  } catch (error) {
    reply = { ok: false, reason: toErrorMessage(error) };
  }
  self.postMessage(reply, reply.ok ? [reply.kek.buffer as ArrayBuffer] : []);
};
