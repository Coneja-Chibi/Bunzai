/** The common state shape for an asynchronous UI load, with optional state-specific payloads. */
type Override<E, S extends string, Fallback> =
  [Extract<E, { state: S }>] extends [never] ? Fallback : Extract<E, { state: S }>;

export type AsyncState<T, Extra extends { state: string } = never> =
  | Override<Extra, "loading", { state: "loading" }>
  | Override<Extra, "failed", { state: "failed"; why: string }>
  | Override<Extra, "ready", { state: "ready" } & T>
  | Exclude<Extra, { state: "loading" | "failed" | "ready" }>;
