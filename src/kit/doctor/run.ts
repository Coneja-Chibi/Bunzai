/**
 * Concurrent bounded doctor runner. Every check receives its own abort signal and timeout, so one
 * stalled provider cannot hide the completed vault, studio, or runtime rows.
 */
import type { DoctorCheck, DoctorContext, DoctorResult } from "./check";
import { toErrorMessage } from "../../error-message";

const DEFAULT_TIMEOUT_MS = 8_000;

const runOne = async (
  check: DoctorCheck,
  context: DoctorContext,
  timeoutMs: number,
): Promise<DoctorResult> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timed out"));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([check.run(context, controller.signal), timeout]);
    return { id: check.id, label: check.label, ...result };
  } catch (error) {
    const detail = toErrorMessage(error);
    return {
      id: check.id,
      label: check.label,
      status: detail === "timed out" ? "warn" : "fail",
      detail,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const runDoctor = (
  checks: readonly DoctorCheck[],
  context: DoctorContext,
  options: { timeoutMs?: number } = {},
): Promise<DoctorResult[]> =>
  Promise.all(
    checks.map((check) => runOne(check, context, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
  );
